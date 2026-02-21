
In this laundry platform (similar to most real-world marketplaces like Uber for X, Airbnb, or local service apps), **regular users** (including laundry partners) **self-register** through the app/dashboard. Admins do **not** manually create accounts for them. Instead, admins act as **gatekeepers** who review and approve/reject partner applications after self-onboarding.

This is a standard "application + approval" flow for service providers in multi-sided platforms. It keeps onboarding scalable and user-initiated while maintaining quality control.

### Business Logic for User & Partner Onboarding + Admin Role

#### 1. User Roles (in `profiles` table – linked to Supabase Auth)
- `role` column (text): `'customer' | 'laundry_owner' | 'admin' | 'driver'` (if added later)
- Default on signup: `'customer'` (or no role until they choose a path)
- Only `'admin'` users get full platform oversight

#### 2. How Regular Users (Customers & Laundry Owners) Join – Self-Service
- **Signup Flow** (via Supabase Auth in frontend):
  - User signs up with email/phone + password / magic link / OTP
  - On first login / profile completion screen: Choose role → `'customer'` or `'laundry_owner'`
  - Update `profiles.role` accordingly (via Supabase client with RLS allowing own-profile update)
- Customers → immediately usable (browse, order)
- Laundry owners → after role selection → redirected to **Partner Application Form**

#### 3. Laundry Partner Onboarding & Approval Flow (Core Change)
**Step-by-step (all frontend-initiated, backend-enforced)**

1. **Application Submission** (Laundry Partner Dashboard – accessible after selecting 'laundry_owner' role)
   - Form fields: business_name, owner_name, phone, email (pre-filled from auth), physical_address, latitude, longitude, services_offered (array/json), price_per_kg, operating_hours (json), capacity_per_day (integer), bank_details (encrypted or via secure field), photos (upload to Supabase Storage)
   - On submit → insert/update row in `laundries` table with:
     - `status` = `'pending_approval'`
     - `owner_user_id` = `auth.uid()`
     - `created_at`, etc.

2. **Admin Review Queue** (Admin Dashboard only)
   - List all `laundries` where `status = 'pending_approval'` (sortable by date, name, location)
   - View full details: profile info, uploaded photos (via Storage signed URLs), map pin
   - Admin actions:
     - **Approve** → calls Edge Function `approve_laundry_partner(laundry_id uuid)`
       - Sets `laundries.status = 'active'`
       - Optionally sets `is_verified = true` or adds badge
       - Sends welcome notification (push/email/SMS) to owner: "Your application is approved! Start receiving orders."
       - Creates initial capacity entry if needed
     - **Reject** → calls Edge Function `reject_laundry_partner(laundry_id uuid, reason text)`
       - Sets `laundries.status = 'rejected'`
       - Stores `rejection_reason`
       - Sends notification to owner: "Your application was not approved. Reason: [reason]. You may re-apply after fixing issues."
     - **Request More Info** (optional) → set status = 'more_info_needed' + send notification with specific requests

3. **Post-Approval Access**
   - Once `status = 'active'`, the laundry owner can access full partner dashboard features (accept orders, update status, view earnings)
   - RLS ensures only active laundries appear in customer searches

4. **Re-application or Edits**
   - Rejected applicants can edit their application (if status allows) and re-submit (resets to 'pending_approval')
   - Active laundries can edit profile (business details, services, capacity) – changes may require re-approval for critical fields (e.g. address change)

#### 4. Admin Onboarding (How Admins Get Added – Separate & Manual/Secure)
Since admins are **internal/platform operators** (not self-onboarding like partners):
- **Only one initial Super Admin** created manually via Supabase Studio dashboard (or during project setup):
  - Insert user into `auth.users` (email/password)
  - Insert matching row in `profiles` with `role = 'admin'`
- **Adding more admins** (by existing admins):
  - Existing admin invites via email (send magic link or temporary password)
  - New person signs up/claims the invite → role set to `'admin'` via secure flow
  - **Recommended secure method**:
    - Admin dashboard has "Invite Admin" button → generates invite token (stored in `admin_invites` table with expiry)
    - Sends email with link → on click, user signs up → Edge Function validates token → sets role = 'admin' + deletes token
  - No self-registration for 'admin' role (prevent abuse)

#### 5. Updated RLS Policies (Key Examples)
```sql
-- Laundry partners can only read/update their own laundry record if active or pending
CREATE POLICY "laundry_owners_manage_own_profile"
ON laundries FOR ALL
TO authenticated
USING (
  owner_user_id = auth.uid()
  AND (status IN ('pending_approval', 'active', 'more_info_needed'))
);

-- Customers & others can only see active laundries
CREATE POLICY "public_see_active_laundries"
ON laundries FOR SELECT
TO authenticated, anon
USING (status = 'active');

-- Admins see all laundries (including pending/rejected)
CREATE POLICY "admins_see_all_laundries"
ON laundries FOR ALL
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Pending applications visible only to admins + owner
CREATE POLICY "pending_visible_to_admin_and_owner"
ON laundries FOR SELECT
TO authenticated
USING (
  status = 'pending_approval'
  AND (
    owner_user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

#### 6. Updated Edge Functions (Minimal Additions/Changes)
- `submit_laundry_application()` → validates input, inserts/updates `laundries` with 'pending_approval'
- `approve_laundry_partner(laundry_id)` → status → 'active', notify
- `reject_laundry_partner(laundry_id, reason)` → status → 'rejected', notify
- `invite_admin(email)` → generate token, send invite email (use Resend/SendGrid via Edge Function)
- `claim_admin_invite(token, user_data)` → validate token, set role = 'admin'

This corrected flow matches real marketplace patterns: self-signup → role selection → application (for providers) → admin approval → activation. No admin manual user creation for partners.

