
```markdown
You are a senior Supabase Edge Functions engineer with deep experience building payment flows, real-time notifications, and geospatial utilities for three-sided marketplaces (similar to DoorDash, Glovo, Rappi, Takealot delivery infrastructure).

**Project**: Laundry Marketplace Platform – Independent Driver Model (Option B) – Johannesburg focus

**Tech stack & constraints (strict)**

- Supabase Edge Functions (Deno 1.40+, TypeScript strict mode)
- Supabase client initialized with **service_role** key for all mutations
- Use `@supabase/supabase-js` ^2
- Zod for strict input validation
- Return shape: { success: boolean, data?: any, error?: { code: string, message: string, details?: any } }
- Use transactions (`BEGIN; COMMIT; ROLLBACK;`) for atomicity
- Idempotency: protect against duplicate webhook calls / duplicate notifications
- Logging: console.error + insert into `edge_function_logs` (severity, message, payload jsonb, created_at)
- Use advisory locks (`pg_advisory_xact_lock`) where race conditions are possible

**Database tables assumed (use exactly these names/structures)**

- `orders`               (id, status, total_price, laundry_id, customer_id, commission_rate numeric DEFAULT 0.15, escrow_status text, payment_intent_id text, ...)
- `payments`             (id, order_id, amount numeric, commission_amount numeric, net_laundry numeric, net_driver numeric, status text, payout_laundry_status text, payout_driver_status text, ...)
- `payouts`              (id, recipient_id uuid, recipient_type text, amount numeric, status text, payout_method text, reference text, created_at, processed_at)
- `notifications`        (id, user_id uuid, title text, body text, type text, data jsonb, read boolean DEFAULT false, channel text[], delivered boolean, ...)
- `laundries`            (id, owner_user_id, status, business_name, ...)
- `deliveries`           (id, order_id, driver_id, type, otp text, otp_expires_at timestamptz, ...)
- `drivers`              (user_id, current_geog geography(Point,4326), is_active, ...)
- `laundry_locations`    (laundry_id, geog geography(Point,4326), ... )   ← or use laundries.geog

**Functions to implement (exact signatures + full business logic)**

### Payment & Webhook Related

1. `handle_payment_webhook(payload jsonb, signature text)`
   - Verify signature (PayFast / Peach Payments / Stripe)
   - Idempotency: check if already processed (payments.webhook_event_id or payments.status = 'succeeded')
   - On 'payment.succeeded':
     - Update `orders.status = 'laundry_requested'`
     - Insert `payments` row
     - Create escrow hold record or mark payment_intent captured
     - Trigger `send_order_notification` to customer & laundry
   - On 'payment.failed' / 'payment.cancelled':
     - Update order status → 'cancelled'
     - Notify customer
   - Return HTTP 200 quickly (webhook best practice)

2. `create_escrow_hold(order_id uuid, amount numeric)`
   - (Only if not using provider-native escrow / hold)
   - Insert / update `payments` row with escrow_status = 'held'
   - Calculate & store commission_amount = amount * orders.commission_rate
   - Return payment record

3. `release_escrow_and_payout(order_id uuid)`
   - Preconditions: order.status = 'completed' AND payments.escrow_status = 'held'
   - Calculate:
     - platform_amount  = commission_amount
     - laundry_amount  = total_price - platform_amount - delivery_fee (if separate)
     - driver_amount   = delivery_fee + tip (if any)
   - Update `payments` → escrow_status = 'released', status = 'settled'
   - Insert two rows into `payouts` (one for laundry, one for driver) with status = 'pending'
   - Update `payments.payout_laundry_status` and `payout_driver_status`
   - Trigger notifications to both parties

### Notification & Communication Helpers

4. `send_order_notification(order_id uuid, recipient_role text, event_type text)`
   - recipient_role ∈ ('customer', 'laundry_owner', 'driver', 'admin')
   - event_type examples: 'order_confirmed', 'driver_assigned', 'pickup_completed', 'delivery_completed', 'order_rejected', 'dispute_opened', ...
   - Lookup correct user_id(s) from order / delivery / laundry
   - Build title/body from templates (hard-coded or from `notification_templates` table)
   - Insert into `notifications` with channel = ['push', 'email'] or ['sms'] depending on user prefs
   - If push: include deep-link data (order_id, screen)
   - Deduplication: do not send same event_type for same order+user within 30 seconds

5. `send_welcome_laundry(laundry_id uuid)`
   - Called after `approve_laundry_partner`
   - Send push + email to laundry owner
   - Content: "Welcome! Your laundry is now live. You can now receive orders."

6. `send_rejection_notification(laundry_id uuid, reason text)`
   - Called after `reject_laundry_partner`
   - Push + email
   - Include reason and link to re-apply / edit application

### Geospatial & OTP Utilities

7. `find_nearest_available_drivers(location geography, radius_km numeric DEFAULT 12, limit integer DEFAULT 5)`
   - Return table of: driver_id, user_id, distance_km, rating, acceptance_rate, current_load
   - Only `drivers.is_active = true`
   - Use PostGIS: ST_DWithin + ST_DistanceSpheroid
   - Order by: (distance_km * 0.4) + ((5 - rating) * 0.3) + ((1 - acceptance_rate) * 0.3)

8. `find_nearest_laundries(customer_location geography, max_radius_km numeric DEFAULT 15, min_capacity integer DEFAULT 5, services text[] DEFAULT '{}')`
   - Return: laundry_id, business_name, distance_km, rating, available_capacity, services_offered
   - Filter: status = 'active' AND capacity_per_day - used_today >= min_capacity
   - Optional services array overlap
   - Ordered by distance then rating desc

9. `generate_otp_for_delivery(delivery_id uuid)`
   - Generate 6-digit numeric OTP
   - Set `deliveries.otp = otp`, `otp_expires_at = now() + 30 minutes`
   - Return otp (only for internal use — never expose to driver app directly)

10. `verify_otp(delivery_id uuid, provided_otp text)`
    - Check `deliveries.otp = provided_otp` AND `otp_expires_at > now()`
    - If valid → return success + optionally clear OTP
    - If invalid or expired → return specific error code

**Non-functional requirements for every function**

- Zod schema for every input parameter
- Explicit permission checks even with service_role (who is allowed to call this?)
- Atomic transactions when modifying multiple tables
- Update `updated_at` on all touched rows
- Return the affected row(s) when it makes sense (optimistic UI)
- Comprehensive error codes: ERR_INVALID_SIGNATURE, ERR_DUPLICATE_WEBHOOK, ERR_OTP_EXPIRED, ERR_INSUFFICIENT_CAPACITY, ERR_NOT_AUTHORIZED, ...
- Photo URLs must be validated to belong to correct storage bucket/path
- Use environment variables for: STRIPE_SECRET, PAYFAST_PASSPHRASE, SMS_API_KEY, etc.

**Deliverables**

Generate complete Edge Functions folder structure:

```
supabase/functions/
├── handle_payment_webhook/
│   └── index.ts
├── release_escrow_and_payout/
│   └── index.ts
├── send_order_notification/
│   └── index.ts
... (one folder per function)
├── _shared/
│   ├── utils.ts          ← templates, error codes, sendPush, sendEmail, etc.
│   └── geo.ts
└── README.md
```

Include:

- `supabase/config.toml` snippet for these functions
- Any required SQL migrations (new tables, indexes, triggers, functions)
- Top-of-file comment block showing happy path + important edge cases
- Security & idempotency notes

Build **exactly** according to the business rules implied in driver-model.md, Laundry_Marketplace_Technical_Specification.docx, partner-onboarding.md, and the payment/payout rules described earlier.

Do **not** invent new business rules. Focus on security, auditability, idempotency, and fast webhook response time.

Start your answer with "✅ Payment, Notification & Utility Edge Functions Generated" and then output the folder structure with code.
