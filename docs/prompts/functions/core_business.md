You are a **senior Supabase architect and production-grade Edge Functions engineer** who has shipped multiple three-sided marketplaces (Uber-style dispatch, DoorDash-style proof-of-delivery, Airbnb-style approvals) using 100% Supabase (PostgreSQL + Edge Functions + RLS + Realtime + Storage).

**Project**: Laundry Marketplace Platform – **Independent Driver Model (Option B)** – MVP launched in Johannesburg (Randburg, Bryanston, Sandton focus).

**Tech Constraints (strict)**
- Supabase Edge Functions (Deno 1.40+, TypeScript strict)
- Use `createClient` with **service_role** key for all business-critical mutations (never let clients write directly to core tables)
- Zod for runtime validation
- `@supabase/supabase-js` v2
- `postgres` driver only when raw SQL is required for complex queries (e.g., Haversine radius search)
- All functions must be idempotent, atomic (use transactions), and fully auditable
- Return consistent JSON shape: `{ success: boolean, data?: any, error?: { code: string, message: string, details?: any } }`
- Logging: use `console.error` + insert into `edge_function_logs` table for observability
- Rate limiting & duplicate protection via `pg_advisory_xact_lock`

**Database Schema Assumptions (use exactly these tables/columns)**
- `profiles` (id uuid PK, role text, ... )
- `laundries` (id uuid PK, owner_user_id uuid, status text CHECK (status IN ('pending_approval','active','rejected','more_info_needed')), capacity_per_day int, ...)
- `drivers` (id uuid PK, user_id uuid, is_active boolean DEFAULT false, current_lat numeric, current_long numeric, rating numeric, acceptance_rate numeric, ...)
- `orders` (id uuid PK, customer_id uuid, laundry_id uuid, status text CHECK (...), total_price numeric, pickup_address text, dropoff_address text, scheduled_pickup timestamptz, ...)
- `deliveries` (id uuid PK, order_id uuid, driver_id uuid, type text CHECK (type IN ('pickup','delivery')), status text, pickup_photo_urls text[], handover_photo_url text, return_photo_urls text[], signature_data jsonb, otp text, note text, ...)
- `delivery_requests` (id uuid PK, delivery_id uuid, driver_id uuid, expires_at timestamptz, status text DEFAULT 'pending')
- `order_status_history` (id serial PK, order_id uuid, from_status text, to_status text, performed_by uuid, performed_at timestamptz DEFAULT now(), metadata jsonb)
- `delivery_issues` (id uuid PK, delivery_id uuid, reported_by uuid, reported_by_role text, reason text, photo_url text, details jsonb, created_at timestamptz)

**Exact Order Status Machine (enforce in `update_order_status` only)**
```sql
'pending' → 'laundry_requested' → 'accepted' / 'rejected'
'accepted' → 'driver_pickup_assigned' → 'pickup_in_progress' → 'picked_up' → 'at_laundry' → 'washing_in_progress' → 'ready_for_delivery' → 'driver_delivery_assigned' → 'delivery_in_progress' → 'completed'
Any status → 'cancelled' | 'disputed' (with admin/driver/laundry/customer rights)
```

**Functions to Implement (exactly these signatures + full business logic)**

1. **`dispatch_driver(task_type text, order_id uuid)`**  
   - task_type = 'pickup' or 'delivery'  
   - First-accept-wins dispatch  
   - Radius 12 km (Haversine), sort by (distance * 0.4 + (5-rating)*0.3 + (100-acceptance_rate)*0.3)  
   - Create up to 5 `delivery_requests` rows with 3-minute expiry  
   - Trigger Supabase Realtime + insert into `notifications` for FCM (driver apps listen)  
   - If no acceptance in 3 min → auto-retry once or notify admin

2. **`accept_delivery_request(delivery_id uuid)`**  
   - First-accept-wins: check `delivery_requests.status = 'pending'` + lock  
   - Assign driver to `deliveries.driver_id`, update statuses (`driver_pickup_assigned` → `pickup_in_progress` or equivalent)  
   - Expire all other requests for same delivery  
   - Generate 6-digit OTP, store in `deliveries.otp`  
   - Return driver details + navigation deep-link payload

3. **`reject_delivery_request(delivery_id uuid, reason text)`**  
   - Mandatory reason (min 10 chars)  
   - Update request status to 'rejected'  
   - If all requests expired → trigger `dispatch_driver` again (recursive safe call)

4. **`confirm_pickup(delivery_id uuid, photo_urls text[], otp text, note text)`**  
   - Validate OTP match + driver owns delivery  
   - Update `deliveries` + `orders.status = 'picked_up'`  
   - Insert history row  
   - Notify laundry & customer (Realtime + notification row)

5. **`confirm_handover_to_laundry(delivery_id uuid, photo_url text, note text)`**  
   - Driver → laundry drop-off (pickup leg)  
   - Update to `at_laundry`

6. **`confirm_laundry_handover(delivery_id uuid, photo_url text)`**  
   - Laundry confirms receipt from driver  
   - Update status + notify driver for return leg readiness

7. **`confirm_return_pickup(delivery_id uuid, photo_url text)`**  
   - Driver picks up clean laundry from partner

8. **`confirm_return_delivery(delivery_id uuid, photo_urls text[], signature_data jsonb, otp text, note text)`**  
   - Final customer delivery  
   - Validate OTP or signature  
   - Set `orders.status = 'completed'`  
   - Mark payouts eligible (`payments` table update)

9. **`report_delivery_issue(delivery_id uuid, reported_by uuid, reported_by_role text, reason text, photo_url text, details jsonb)`**  
   - Any party (driver/laundry/customer)  
   - Set `orders.status = 'disputed'` if critical  
   - Notify all parties + admin

10. **`update_order_status(order_id uuid, new_status text, performed_by uuid, metadata jsonb)`**  
    - **Central guardrail**: validate allowed transition using a transition table or switch  
    - Enforce who can perform which transition (e.g., only driver can go to `picked_up`)  
    - Write to `order_status_history`  
    - Trigger any side effects (e.g., dispatch on `ready_for_delivery`)

11. **`accept_order(order_id uuid, laundry_id uuid)`**  
    - Laundry accepts → `orders.status = 'accepted'` + deduct capacity  
    - Auto-trigger `dispatch_driver('pickup', order_id)`

12. **`reject_order(order_id uuid, laundry_id uuid, reason text)`**  
    - Mandatory reason  
    - Notify customer + admin if needed

**Additional Required Functions (must include for completeness)**
- `approve_laundry_partner(laundry_id uuid)`
- `reject_laundry_partner(laundry_id uuid, reason text)`
- `submit_laundry_application(...)` (validation + insert with pending_approval)
- `process_payouts(week_start timestamptz)` (batch driver + laundry payouts)

**Requirements for Every Function**
- Full Zod schema validation on input
- RLS bypass only via service_role + explicit authorization checks
- Transaction safety (`BEGIN; ... COMMIT;`)
- Optimistic locking where needed
- Comprehensive error codes (e.g., `ERR_INVALID_TRANSITION`, `ERR_OTP_MISMATCH`, `ERR_CAPACITY_EXCEEDED`)
- Real-time notifications: insert row into `notifications` table (user_id, title, body, data jsonb, read boolean)
- Photo URLs must be Supabase Storage signed URLs (validate they belong to correct bucket/folder)
- All mutations update `updated_at` timestamps
- Return full updated row(s) on success for optimistic UI

**Deliverables**
Output a **complete Supabase Edge Functions folder structure** ready to `supabase functions deploy`:

```
supabase/functions/
├── dispatch_driver/
│   └── index.ts
├── accept_delivery_request/
│   └── index.ts
... (one folder per function)
├── _shared/          # utils: validateTransition, haversine, sendNotification, etc.
└── README.md         # deployment + testing instructions
```

Include:
- Exact `supabase/config.toml` snippet for these functions
- SQL migration for any new tables/indexes/triggers needed
- Unit-test style comments at top of each file showing happy path + edge cases
- Security notes (what RLS policies must exist)

**Build exactly to the documents** provided in context (driver-model.md status machine, Laundry_Marketplace_Technical_Specification, partner-onboarding.md, admin.md, etc.). Do **not** add extra features. Prioritise security, auditability, and first-accept-wins dispatch correctness.

Begin your response with "✅ Core Business Logic Edge Functions Generated" and output the full folder structure with code.
