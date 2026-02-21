You are an expert Supabase Edge Functions developer with deep experience building secure, scalable multi-sided marketplace platforms (similar to Airbnb/partner onboarding flows or service provider approval systems).

Build **production-grade Supabase Edge Functions** (Deno/TypeScript) exclusively for the **Laundry Partner (Laundry Owner) onboarding and approval lifecycle** of the Laundry Marketplace Platform (independent driver model – Option B).

Strict rules to follow:

1. Implement **only** the functions explicitly listed below — no extras, no nice-to-haves, no order/delivery/payout logic.
2. These functions are **only** used in:
   - Laundry partner dashboard (submit / edit application)
   - Admin dashboard (approve / reject / request more info)
3. All business-critical writes and state changes **must** go through these Edge Functions (never direct client-side DB writes).
4. Use strict TypeScript + Zod for input validation.
5. Enforce role-based authorization (only laundry_owner can submit, only admin can approve/reject/request info).
6. Send appropriate notifications (email/push) after approval/rejection/more-info requests (use Resend integration pattern).
7. Create audit log entries in admin_audit_logs for all admin decisions (approve/reject/request more info).
8. Return clean JSON responses with { data?, error?, message? }.
9. Throw proper HTTP errors (Response objects) on validation/auth failure.

Required Edge Functions to implement (exactly these four – nothing else):

1. submit_laundry_application
   - Params: laundry_data: jsonb (zod-validated object)
   - Allowed caller: authenticated user with role = 'laundry_owner'
   - Logic:
     - Validate input with strict Zod schema (business_name, address, lat/long, services_offered[], price_per_kg, capacity_per_day, operating_hours json, bank_details, photos[] etc.)
     - If new → INSERT into laundries with status = 'pending_approval', owner_user_id = auth.uid()
     - If existing (update) → UPDATE only if status IN ('pending_approval', 'more_info_needed', 'rejected')
     - Upload photo URLs to Supabase Storage if provided (return signed URLs)
     - Set updated_at, etc.
     - If critical fields changed (address, services, capacity) → set requires_reapproval = true (if already active)
     - Return { success: true, laundry_id: uuid, status: string }
   - RLS note: policy already allows owner to manage own record

2. approve_laundry_partner
   - Params: laundry_id: uuid
   - Allowed caller: authenticated user with role = 'admin'
   - Logic:
     - Check laundry exists and status = 'pending_approval' or 'more_info_needed'
     - UPDATE laundries SET status = 'active', is_verified = true, approved_at = now(), approved_by = auth.uid()
     - Reset requires_reapproval = false if present
     - Create admin_audit_logs entry (action: "approve_laundry_partner", target_id: laundry_id, details: { laundry_name })
     - Send welcome notification:
       - Email via Resend ("Your laundry partner application is approved! Start receiving orders.")
       - Optional push if Expo token exists
     - Return { success: true, message: "Partner approved and activated" }

3. reject_laundry_partner
   - Params: laundry_id: uuid, reason: string (min length 10)
   - Allowed caller: admin only
   - Logic:
     - Validate exists and not already 'active'
     - UPDATE laundries SET status = 'rejected', rejection_reason = reason, rejected_at = now(), rejected_by = auth.uid()
     - Audit log: action "reject_laundry_partner", details { reason, laundry_name }
     - Send rejection email to owner: "Application not approved. Reason: {reason}. You may edit and re-apply."
     - Return success or structured error

4. request_more_info_laundry
   - Params: laundry_id: uuid, requested_fields: string[] (e.g. ["photos", "bank_details"]), message: string
   - Allowed caller: admin only
   - Logic:
     - Validate exists and status IN ('pending_approval', 'more_info_needed')
     - UPDATE laundries SET status = 'more_info_needed', more_info_requested_at = now(), more_info_requested_by = auth.uid(), more_info_message = message, requested_fields = array
     - Audit log: action "request_more_info_laundry", details { requested_fields, message }
     - Send notification to owner:
       - Email: "We need more information to review your application: {message}. Please update: {requested_fields.join(', ')}"
       - Optional push
     - Return { success: true, message: "More info requested" }

Technical & Security Requirements (apply to all functions):

- Use createClient from @supabase/supabase-js with service_role key only when necessary (e.g., for audit logging or cross-table writes); prefer authenticated client context when possible.
- Zod schemas must be strict and detailed (use .refine() for business rules like capacity > 0, valid lat/long, etc.).
- Use Deno.env.get() for secrets (RESEND_API_KEY, etc.).
- Implement email sending via Resend (follow official Supabase + Resend pattern: fetch('https://api.resend.com/emails', ...)).
- Audit logging structure (admin_audit_logs table assumed):
  - id, performed_by (uuid), action (text), target_type ('laundry'), target_id (uuid), details (jsonb), created_at
- Error handling: return 400/401/403/422 with { error: { code, message } }
- Add JSDoc comments explaining:
  - Who can call
  - Business purpose
  - Side effects (notifications, audit, status change)

Do NOT implement:
- Any order-related logic (accept_order, update_order_status, dispatch_driver, etc.)
- Driver-specific functions
- Payout / commission / dispute logic
- Customer-facing flows
- Anything not directly tied to laundry partner profile submission → approval lifecycle

Deliver the complete code for **all 4 functions** in separate, clearly named blocks, ready for deployment as Supabase Edge Functions.

Suggested folder structure:
supabase/functions/
  submit_laundry_application/index.ts
  approve_laundry_partner/index.ts
  reject_laundry_partner/index.ts
  request_more_info_laundry/index.ts

Include example Zod schemas at the top of each file (or in a shared types file if you prefer).