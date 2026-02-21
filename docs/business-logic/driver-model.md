**Updated Business Logic Specification – Laundry Marketplace MVP (Option B: Independent Driver Network Selected)**  
**Built 100% on Supabase (direct client access + Edge Functions + RLS where needed)**  
**Date: 17 February 2026**  
**Version: 3.0 – Full Independent Driver Model Enabled**

This assumes the **independent driver model** is selected from the start (Option B from your concept doc). The platform dispatches drivers for both **pickup** (customer → laundry) and **return delivery** (laundry → customer) automatically after key milestones.

The core order flow remains similar, but now includes driver assignment, real-time dispatch, proof-of-delivery steps, and status synchronization across customer, laundry, and driver apps.

### 1. Order Status Machine (Expanded for Driver Model)
```sql
status ENUM (
  'pending',                -- Customer just placed order
  'laundry_requested',      -- Sent to laundry for acceptance
  'accepted',               -- Laundry accepted
  'driver_pickup_assigned', -- Driver assigned for customer pickup
  'pickup_in_progress',     -- Driver en route to customer
  'picked_up',              -- Driver collected from customer
  'at_laundry',             -- Delivered to laundry by driver
  'washing_in_progress',    -- Laundry processing
  'ready_for_delivery',     -- Laundry finished, ready for return
  'driver_delivery_assigned', -- Driver assigned for return
  'delivery_in_progress',   -- Driver en route to customer
  'completed',              -- Delivered back to customer
  'cancelled', 'disputed'
)
```

**Allowed Transitions** (enforced via Edge Function `update_order_status()` or triggers):
- pending → laundry_requested (auto on payment success)
- laundry_requested → accepted / rejected (laundry within 30 min)
- accepted → driver_pickup_assigned (auto-dispatch to nearest available driver)
- driver_pickup_assigned → pickup_in_progress (driver accepts & starts route)
- pickup_in_progress → picked_up (driver confirms pickup with proof)
- picked_up → at_laundry (driver confirms drop-off at laundry)
- at_laundry → washing_in_progress / ready_for_delivery (laundry updates)
- ready_for_delivery → driver_delivery_assigned (auto-dispatch)
- driver_delivery_assigned → delivery_in_progress → completed (driver confirms delivery with proof)

### 2. Driver Assignment & Dispatch Logic (New – Core for Option B)
**Edge Function**: `dispatch_driver(task_type, order_id)` (task_type = 'pickup' or 'delivery')

1. Query available drivers:
   - `is_active = true`
   - Within radius (e.g., 10–15 km from pickup/dropoff location)
   - Sorted by: proximity (Haversine) + rating + acceptance rate + current load

2. Push real-time notification (Supabase realtime + FCM) to top 3–5 drivers.
3. **First-accept-wins** model: Driver accepts → assigned to `deliveries.driver_id`
   - Others get "assignment expired" push.
4. If no accept within 2–3 min → re-dispatch or fallback (notify admin/laundry).

### 3. Driver App – What Drivers Can Do (Detailed Actions & Rules)
**Driver Role**: `role = 'driver'` in profiles, linked to `drivers` table (vehicle_type, license, current_lat/long, is_active).

**Key Actions in Driver App**:

- **Availability Toggle**
  - Online/Offline switch → updates `drivers.is_active` and location tracking starts/stops (background location permission required).

- **Incoming Request Handling**
  - Receive push + in-app alert for new pickup/delivery request.
  - View: customer/laundry address, items summary, special notes, ETA, estimated pay.
  - **Accept/Reject** button (reject requires reason, e.g., "too far").
  - On accept: auto-assign, start navigation (Google Maps deep link).

- **Pickup Confirmation Flow** (Customer → Laundry)
  - Arrive at customer:  OTP → driver scans/enters.
  - Take **mandatory photo proof** (sealed bag, condition of items).
  - Optional note (e.g., "bag heavier than estimated").
  - Status → `picked_up` → notify laundry + customer.

- **Drop-off at Laundry Confirmation**
  - At laundry: Laundry scans QR / confirms receipt (or driver photo of handover).
  - Status → `at_laundry` → laundry takes over processing.

- **Return Delivery Confirmation Flow** (Laundry → Customer)
  - Pick up from laundry: Similar photo/confirmation.
  - Arrive at customer: Customer confirms receipt (photo + signature/OTP).
  - Status → `completed` → triggers payout eligibility for driver + laundry.

- **Issue Reporting**
  - Report: "Customer not home" (photo of door/note left), "Wrong address", "Damaged bag" → upload photo → notifies admin/laundry/customer.
  - Cancel delivery (with reason) → re-dispatch or escalate.

- **Earnings & Performance**
  - View per-delivery pay (base fee + distance bonus + tip).
  - Weekly/monthly summary.
  - Metrics: on-time %, acceptance rate, rating → affects dispatch priority.

**Enforcement**:
- RLS: Drivers only see their assigned `deliveries` rows.
- Edge Function: `confirm_pickup_delivery()` requires photo upload + OTP/signature validation.

### 4. Laundry Partner App – Adjustments for Driver Model
Laundries no longer handle logistics themselves — drivers do.

**Updated Actions**:

- Accept/reject orders as before (but now only washing/processing).
- Update internal statuses: `at_laundry` → `washing_in_progress` → `ready_for_delivery`.
- **Handover to Driver** (return leg): Confirm driver pickup (scan QR/photo).
- **Receive from Driver** (pickup leg): Confirm drop-off from driver.
- View driver ETA on return delivery (realtime location shared during active delivery).
- Flag issues (e.g., "bag arrived damaged") with photo → dispute trigger.

**Capacity**: Still managed as before (deduct on acceptance).

### 5. Customer App – Visibility Enhancements
- Real-time tracking: See driver location during pickup/delivery phases.
- ETA updates + driver photo (optional, for trust).
- Confirm receipt on return delivery (signature/photo).

### 5.b. Payment & Payout Rules (Driver Impact)
- Customer pays full amount at order creation (escrow/hold).
- On `completed`: 
  - Platform deducts commission (15%).
  - Laundry receives net (after commission).
  - Driver receives delivery fee (base + distance + any tip) — separate payout.
- Payouts: Batch weekly (Edge Function `process_payouts()`).

### 6. New/Updated Tables
- `deliveries` (id, order_id, driver_id, type ('pickup'/'delivery'), status, pickup_photo_url, delivery_photo_url, signature_data, otp_code, etc.)
- `drivers` (user_id, current_lat/long, is_active, rating, acceptance_rate)

### 7. Recommended Edge Functions (Driver-Focused)
- `dispatch_driver(order_id, task_type)`
- `accept_delivery_request(delivery_id)`
- `confirm_pickup(delivery_id, photo_urls, otp)`
- `confirm_handover_to_laundry(delivery_id, photo_url)`
- `confirm_return_delivery(delivery_id, photo_urls, signature)`
- `report_delivery_issue(delivery_id, reason, photo_url)`

This makes the platform a full three-sided marketplace with independent drivers handling logistics end-to-end. Security (proof photos, OTPs) reduces disputes, realtime dispatch improves efficiency.

