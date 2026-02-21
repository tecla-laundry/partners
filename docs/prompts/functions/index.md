Here is the **complete, consolidated list** of all Supabase Edge Functions that should be implemented across the entire Laundry Marketplace Platform, based on the full specification (admin dashboard, partner dashboard, driver app, customer app flows, and the independent driver model – Option B).

I've grouped them by primary responsibility / caller for clarity, but many functions are shared / called from multiple fronts.

### Shared / Core Business Logic Functions
- `dispatch_driver(task_type text, order_id uuid)`  
  → Main dispatch logic (pickup or delivery leg), first-accept-wins
- `accept_delivery_request(delivery_id uuid)`  
  → Driver accepts incoming request
- `reject_delivery_request(delivery_id uuid, reason text)`  
  → Driver rejects (with mandatory reason)
- `confirm_pickup(delivery_id uuid, photo_urls text[], otp text, note text)`  
  → Driver confirms pickup from customer
- `confirm_handover_to_laundry(delivery_id uuid, photo_url text, note text)`  
  → Driver confirms drop-off at laundry (pickup leg)
- `confirm_laundry_handover(delivery_id uuid, photo_url text)`  
  → Laundry confirms receipt from driver (pickup leg)
- `confirm_return_pickup(delivery_id uuid, photo_url text)`  
  → Driver confirms pickup from laundry (delivery leg)
- `confirm_return_delivery(delivery_id, photo_urls text[], signature_data jsonb, otp text, note text)`  
  → Driver confirms final delivery to customer
- `report_delivery_issue(delivery_id uuid, reported_by text, reason text, photo_url text, details jsonb)`  
  → Any party reports issue during delivery
- `update_order_status(order_id uuid, new_status text, performed_by uuid, metadata jsonb)`  
  → Controlled status transitions (with validation)
- `accept_order(order_id uuid, laundry_id uuid)`  
  → Laundry accepts incoming order request
- `reject_order(order_id uuid, laundry_id uuid, reason text)`  
  → Laundry rejects incoming order

### Partner (Laundry Owner) Specific
- `submit_laundry_application(laundry_data jsonb)`  
  → Laundry owner submits / updates application
- `approve_laundry_partner(laundry_id uuid)`  
  → Admin approves → status = 'active'
- `reject_laundry_partner(laundry_id uuid, reason text)`  
  → Admin rejects
- `request_more_info_laundry(laundry_id uuid, requested_fields text[], message text)`  
  → Admin requests more information

### Admin / Platform Operations
- `invite_admin(email text, role text)`  
  → Super admin invites new admin user
- `claim_admin_invite(token uuid, user_data jsonb)`  
  → New admin claims invite → sets role
- `process_payouts(period_start date, period_end date)`  
  → Batch process weekly payouts (drivers + laundries)
- `calculate_order_commissions(order_id uuid)`  
  → Triggered on completion (or on-demand)
- `resolve_dispute(dispute_id uuid, resolution text, refund_amount numeric, notify_parties boolean)`  
  → Admin resolves dispute
- `force_order_status(order_id uuid, new_status text, reason text)`  
  → Admin manual override (with audit)

### Payment & Webhook Related
- `handle_payment_webhook(payload jsonb, signature text)`  
  → Stripe / PayFast / Peach Payments webhook handler
- `create_escrow_hold(order_id uuid, amount numeric)`  
  → (if not done via payment provider directly)
- `release_escrow_and_payout(order_id uuid)`  
  → On completion – release funds minus commission

### Notification & Communication Helpers
- `send_order_notification(order_id uuid, recipient_role text, event_type text)`  
  → Unified notification sender (push + email + SMS)
- `send_welcome_laundry(laundry_id uuid)`  
  → After approval
- `send_rejection_notification(laundry_id uuid, reason text)`  
  → After rejection

### Optional / Frequently Useful Utilities (commonly implemented)
- `find_nearest_available_drivers(location geography, radius_km numeric, limit integer)`  
  → Used internally by `dispatch_driver`
- `find_nearest_laundries(customer_location geography, max_radius_km numeric, min_capacity integer, services text[])`  
  → Customer app – find suitable laundries
- `generate_otp_for_delivery(delivery_id uuid)`  
  → Create & store short-lived OTP
- `verify_otp(delivery_id uuid, provided_otp text)`  
  → Validate OTP during confirmation

### Summary – Estimated Total Unique Edge Functions

| Category                        | Count |
|-------------------------------|-------|
| Delivery / Driver flow          | 10–12 |
| Order acceptance (laundry)      | 2–3   |
| Laundry onboarding / approval   | 3–4   |
| Admin platform operations       | 5–7   |
| Payment & payout                | 3–5   |
| Notifications                   | 3–5   |
| Utility / helper                | 4–6   |
| **Total estimated**             | **30–42** |

**Most important / must-have functions (MVP priority)** – the ones explicitly named in the specs:

1. dispatch_driver
2. accept_delivery_request
3. reject_delivery_request
4. confirm_pickup
5. confirm_handover_to_laundry
6. confirm_return_delivery
7. accept_order
8. reject_order
9. submit_laundry_application
10. approve_laundry_partner
11. reject_laundry_partner
12. process_payouts
13. handle_payment_webhook
14. update_order_status
15. report_delivery_issue

