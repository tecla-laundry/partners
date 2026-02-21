**Business Logic Specification – Laundry Marketplace MVP (Option A: Laundry-Handled Delivery)**  
**Built for Supabase (direct client access + Edge Functions where needed)**  
**Date: 17 February 2026**  
**Purpose**: This document translates the original Technical Specification + Developer Concept into precise, implementable rules. Every rule here will become either:  
1. A Supabase table column / constraint  
2. A Row Level Security (RLS) policy  
3. A Supabase Edge Function or Postgres Trigger / Function  
4. A frontend guard (UI validation – never trusted alone)

### 1. Order Status Machine (Core State Machine – Enforced in Database)
```sql
status ENUM ('pending', 'laundry_requested', 'accepted', 'rejected', 'picked_up', 'at_laundry', 'washing', 'ready_for_pickup', 'completed', 'cancelled', 'disputed')
```

**Allowed Transitions** (enforced via Edge Function `update_order_status()` or Postgres trigger):

- pending → laundry_requested (customer places order)
- laundry_requested → accepted OR rejected (laundry partner decides within 30 minutes)
- accepted → picked_up (customer drops off / laundry collects)
- picked_up → at_laundry
- at_laundry → washing
- washing → ready_for_pickup
- ready_for_pickup → completed (laundry returns clothes)
- Any state → cancelled (only if before washing starts, with 10% cancellation fee)
- Any state (except completed) → disputed (customer/laundry can trigger)

### 2. Order Creation & Matching Logic
**Step-by-step (all executed in Edge Function `create_order()` – never pure frontend)**

1. Customer selects:
   - Service type(s) + quantities (e.g. 5kg wash & fold, 2 shirts dry-clean)
   - Pickup time slot (must be ≥ 2 hours in future, within operating hours of selected laundry)

2. System calculates **total_price** =  
   `sum(service_base_price × quantity) + service_fee + pickup_fee_if_any`

3. **Matching** (run inside `create_order()` Edge Function):
   - Find laundries where:
     - distance ≤ 8 km (Haversine formula on lat/long)
     - capacity_per_day remaining ≥ total_kg
     - is_active = true
     - accepts the service type
   - Sort by: (rating × 0.6) + (proximity_score × 0.4)
   - Auto-assign to **highest-ranked laundry** that has free slots in the requested time slot
   - If none available → show “No laundries available at this time – try later”

4. Order is inserted with status = 'pending'  
   → Immediately triggers RLS-protected update to status = 'laundry_requested'  
   → Push notification + in-app alert to that laundry partner

### 3. Laundry Acceptance / Rejection Window
- Laundry partner has **exactly 30 minutes** from `laundry_requested` to accept/reject.
- If no action after 30 min → automatic rejection + customer notified + refund (minus 5% platform fee)
- On accept:
  - Set status = 'accepted'
  - Reduce laundry’s `capacity_per_day` by total_kg
  - Lock the time slot for that laundry

### 4. Payment & Escrow Logic (Critical – All in Edge Functions)
**Customer pays full amount at order creation** (via Yoco/PayFast redirect → webhook)

Edge Function `process_payment_webhook()`:

1. On successful payment:
   - status → 'laundry_requested'
   - `total_price` recorded
   - `commission_amount` = total_price × 0.15 (15% default – configurable by admin)
   - `platform_fee` = R15 fixed (covers payment gateway fees)
   - Funds are held in Yoco/PayFast merchant balance (or use Paystack Escrow if available)

2. On order completion (status = 'completed'):
   - Edge Function `release_payouts()` runs (scheduled daily or on completion)
   - Laundry receives: total_price - commission_amount - platform_fee
   - Platform keeps commission + platform_fee

3. Cancellation before washing:
   - Customer gets 90% refund (10% platform fee)
   - Laundry gets 0

4. Dispute:
   - Admin manually decides split (e.g. 50/50 refund) via admin dashboard → triggers payout adjustment

### 5. Capacity Management (Simple but Important)
- Laundries set `capacity_per_day` (e.g. 200 kg) in their profile
- Each accepted order deducts `total_kg` from that day’s remaining capacity
- If remaining_capacity < requested_kg → cannot accept order
- Capacity resets at midnight (cron job / scheduled Edge Function)

### 6. Notifications & Real-time (Supabase Realtime + FCM)
Triggers (via Postgres triggers or Edge Functions):

- Order created → notify laundry
- Status change → notify customer + laundry
- Order ready → notify customer
- 30-min acceptance window almost expired → remind laundry

### 7. Key RLS Policies You Must Implement (Non-negotiable for security)

```sql
-- Customers can only see their own orders
create policy "customers see own orders"
on orders for select using (customer_id = auth.uid());

-- Laundries can only see orders assigned to them
create policy "laundries see own orders"
on orders for all using (laundry_id = (select id from laundries where owner_user_id = auth.uid()));

-- Admins can see everything
create policy "admins see all"
on orders for all using (exists(select 1 from users where id = auth.uid() and role = 'admin'));
```

### 8. Tables You Need (Exact Schema – Ready to Copy into Supabase)

- **users** (Supabase Auth table – just add role column)
- **laundries**
- **orders**
- **order_items** (one row per service type – wash&fold 5kg, dry-clean 3 shirts, etc.)
- **payments**
- **payouts**
- **capacity_logs** (audit of daily capacity usage)
- **notifications** (for history)

### 9. Edge Functions You Will Need (Minimal Set – 5–7 functions max)

1. `create_order()` – pricing, matching, capacity check, insert
2. `update_order_status()` – validate transition + capacity logic
3. `process_payment_webhook()` – on success/failure
4. `release_payouts()` – daily/weekly batch
5. `check_acceptance_window()` – cron that auto-rejects expired requests
6. `calculate_commission()` – reusable function

