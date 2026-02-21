You are an expert Supabase Edge Functions developer with deep experience in multi-sided marketplace platforms (similar to Uber/Airbnb for services). 

Build **production-grade Supabase Edge Functions** (Deno/TypeScript) exclusively for the **Admin / Platform Operations** scope of the Laundry Marketplace Platform (independent driver model – Option B).

Strictly follow these rules:

1. Only implement functions that are:
   - Explicitly named or strongly implied in the admin dashboard spec (admin.md)
   - Explicitly named or strongly implied in driver-model.md Edge Function list
   - Required for critical admin safety/net actions (disputes, manual overrides, payouts, admin invites)
   - Actually called out in partner-onboarding.md or technical specification documents

2. Remove or do NOT implement anything that is:
   - Already covered by laundry/partner or driver actions
   - Customer-facing logic
   - Duplicated functionality
   - Nice-to-have or future features not in current scope (MVP/admin-critical only)

3. Use strict TypeScript, Zod for input validation, proper error handling (throw HttpError), RLS-aware logic, and audit logging where required.

Required Edge Functions to implement (only these – no extras):

1. invite_admin
   - Params: email: string, role: 'admin' (only allow 'admin')
   - Logic: Only callable by existing admin (check role in profiles)
   - Generate secure invite token (uuid), store in admin_invites table (email, token, expires_at, invited_by)
   - Send invite email (use Resend or dummy for now) with claim link
   - Return { success: true, message: "Invite sent" }

2. claim_admin_invite
   - Params: token: string, user_data: { email?: string, ... } (optional)
   - Logic: Validate token exists, not expired, not claimed
   - If user already signed up → update profile.role = 'admin'
   - If new user → can either auto-create or require signup first (choose secure option)
   - Mark invite as claimed, set role, audit log
   - Return success or error

3. process_payouts
   - Params: period_start: string (ISO date), period_end: string (ISO date)
   - Logic: Only callable by admin
   - Find all completed orders/deliveries in period where payout_status = 'pending'
   - Calculate net amounts:
     - Platform commission (global rate or per-laundry override)
     - Laundry net = laundry_fee - commission
     - Driver net = delivery_fee + tip (if any)
   - Create payout records (new table: payouts or update payments)
   - Mark as 'processed' or 'queued'
   - Optional: trigger webhook or email notification
   - Audit log the batch action
   - Return summary: { total_laundry: number, total_drivers: number, total_platform: number, count: number }

4. calculate_order_commissions
   - Params: order_id: string (uuid)
   - Logic: Called on order completion (trigger) or manually by admin
   - Read order + related deliveries + items
   - Calculate:
     - total_customer_amount
     - platform_commission (15% default or override)
     - laundry_share
     - driver_share (pickup + delivery legs)
   - Update payments or finances row
   - Set commission_calculated = true
   - Return breakdown object

5. resolve_dispute
   - Params: dispute_id: string, resolution: string, refund_amount?: number, notify_parties: boolean = true
   - Logic: Admin only
   - Validate dispute exists and is open
   - Update dispute status → 'resolved'
   - If refund_amount > 0 → create refund record (or mark for Stripe/webhook)
   - Add resolution note
   - If notify_parties → queue notifications (customer, laundry, driver)
   - Audit log: who resolved, what decision, amount
   - Return success

6. force_order_status
   - Params: order_id: string, new_status: string, reason: string
   - Logic: Admin only – emergency override
   - Validate new_status is allowed in status enum
   - Update orders.status (bypass normal transition rules)
   - Create admin_audit_logs entry:
     - action: "force_order_status"
     - performed_by: auth.uid()
     - target_id: order_id
     - details: { old_status, new_status, reason }
   - If status affects payouts/deliveries → add appropriate side-effects (e.g. mark for recalc)
   - Trigger relevant Realtime broadcast
   - Return success

Additional technical requirements:

- Use Supabase client inside Edge Functions (createClient with service_role key when needed)
- Implement proper input validation with Zod
- Return JSON responses with { data?, error?, message? }
- Use Deno HTTP error conventions (throw new Response(...))
- Include basic rate limiting check if possible
- Log important actions to admin_audit_logs table (structure: id, performed_by, action, target_type, target_id, details jsonb, created_at)
- Add JSDoc-style comments explaining business purpose + who can call each function

Do NOT implement:
- accept_order / reject_order (laundry role)
- dispatch_driver (automatic + laundry-triggered)
- confirm_pickup / confirm_handover / confirm_delivery (driver role)
- submit_laundry_application / approve_laundry_partner / reject_laundry_partner (already in partner-onboarding.md scope)

Deliver the complete code for **all 6 functions** in separate clearly named blocks, ready to be deployed as Supabase Edge Functions.

Folder structure hint:
supabase/functions/
  invite_admin/index.ts
  claim_admin_invite/index.ts
  process_payouts/index.ts
  calculate_order_commissions/index.ts
  resolve_dispute/index.ts
  force_order_status/index.ts