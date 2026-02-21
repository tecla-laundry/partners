# Admin Tables Schema

## Prompt

You are a Supabase database architect. Create the `admin_audit_logs` and `admin_invites` table schemas for the Laundry Marketplace Platform to manage admin actions audit trail and admin user invitations.

### Requirements

1. **Table Names**: `admin_audit_logs` (audit trail) and `admin_invites` (invitation tokens)
2. **Primary Keys**: `id` (UUID) for both
3. **Purpose**: Track all admin actions for compliance/audit and manage admin user invitations

## Admin Audit Logs Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `performed_by` (UUID, NOT NULL, references `profiles.id`)
- `action` (TEXT, NOT NULL) - Action type: `'approve_laundry' | 'reject_laundry' | 'force_order_status' | 'process_payout' | 'resolve_dispute' | 'invite_admin' | 'suspend_driver' | 'update_settings'`
- `target_type` (TEXT, NOT NULL) - `'laundry' | 'order' | 'driver' | 'payout' | 'dispute' | 'admin' | 'settings'`
- `target_id` (UUID, nullable) - ID of the target entity
- `details` (JSONB, nullable) - Action-specific data: `{ "reason": "...", "old_value": "...", "new_value": "..." }`
- `ip_address` (INET, nullable) - IP address of admin
- `user_agent` (TEXT, nullable) - Browser/client info
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Every admin action must be logged
- Logs are immutable (no updates/deletes)
- `performed_by` must have `role = 'admin'`
- `details` JSONB stores action-specific context
- IP address and user agent for security auditing

## Admin Invites Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `email` (TEXT, NOT NULL)
- `token` (UUID, NOT NULL, UNIQUE, DEFAULT gen_random_uuid())
- `invited_by` (UUID, NOT NULL, references `profiles.id`)
- `role` (TEXT, NOT NULL, DEFAULT 'admin') - Future: could support different admin roles
- `expires_at` (TIMESTAMPTZ, NOT NULL) - Invite expiry (7 days default)
- `claimed_at` (TIMESTAMPTZ, nullable) - When invite was claimed
- `claimed_by` (UUID, nullable, references `profiles.id`) - User who claimed invite
- `is_active` (BOOLEAN, DEFAULT true) - Can be deactivated without deletion
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- One active invite per email (enforced via unique constraint or application logic)
- Invites expire after 7 days
- Invites can be revoked by setting `is_active = false`
- Token is single-use (deleted or marked inactive after claim)
- Only admins can create invites

### Row Level Security (RLS) Policies

#### Admin Audit Logs Table

1. **Admins can see all audit logs**
   ```sql
   CREATE POLICY "admins_see_all_audit_logs"
   ON admin_audit_logs FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

2. **System can create audit logs (service_role)**
   - Audit log creation via Edge Functions

#### Admin Invites Table

1. **Admins can manage invites**
   ```sql
   CREATE POLICY "admins_manage_invites"
   ON admin_invites FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

2. **Public can read active invites by token (for claim flow)**
   ```sql
   CREATE POLICY "public_read_invite_by_token"
   ON admin_invites FOR SELECT
   TO anon, authenticated
   USING (
     is_active = true
     AND expires_at > now()
     AND claimed_at IS NULL
   );
   ```

### Indexes

#### Admin Audit Logs Table

- Index on `performed_by` for admin action history
- Index on `target_type` and `target_id` for entity lookups
- Index on `action` for action filtering
- Index on `created_at` for time-based queries
- Composite index on `(performed_by, created_at DESC)` for admin dashboard

#### Admin Invites Table

- Index on `token` (unique) for invite lookups
- Index on `email` for email-based queries
- Index on `is_active` and `expires_at` for active invite queries
- Index on `invited_by` for inviter history

### Triggers

- Trigger to validate `performed_by` has admin role (optional, enforced in Edge Function)
- Trigger to auto-expire invites after `expires_at`

### Migration SQL

```sql
-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('laundry', 'order', 'driver', 'payout', 'dispute', 'admin', 'settings')),
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create admin_invites table
CREATE TABLE IF NOT EXISTS admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_performed_by ON admin_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_performer_time ON admin_audit_logs(performed_by, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_invites_token ON admin_invites(token);
CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON admin_invites(email);
CREATE INDEX IF NOT EXISTS idx_admin_invites_active_expires ON admin_invites(is_active, expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_invites_invited_by ON admin_invites(invited_by);

-- Enable RLS
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create function to auto-expire invites
CREATE OR REPLACE FUNCTION expire_admin_invites()
RETURNS void AS $$
BEGIN
  UPDATE admin_invites
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now()
    AND claimed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Schedule auto-expiry (run via cron or Edge Function)
```

### Notes

- Audit logs are created by Edge Functions: `approve_laundry_partner`, `reject_laundry_partner`, `force_order_status`, etc.
- Audit logs are immutable and should never be deleted (compliance requirement)
- Admin invites are created by Edge Function `invite_admin()`
- Invite claims are handled by Edge Function `claim_admin_invite()`
- IP address and user agent are captured from request headers in Edge Functions
- Audit logs can be exported for compliance reporting
