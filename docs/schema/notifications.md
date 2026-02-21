# Notifications and Notification Templates Table Schema

## Prompt

You are a Supabase database architect. Create the `notifications` and `notification_templates` table schemas for the Laundry Marketplace Platform to manage in-app notifications, push notifications, and notification templates.

### Requirements

1. **Table Names**: `notifications` (user notifications) and `notification_templates` (reusable templates)
2. **Primary Keys**: `id` (UUID) for both
3. **Purpose**: Store user notifications, push notification history, and reusable notification templates

## Notifications Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id` (UUID, NOT NULL, references `profiles.id`)
- `title` (TEXT, NOT NULL)
- `body` (TEXT, NOT NULL)
- `type` (TEXT, NOT NULL) - `'order_update' | 'delivery_assigned' | 'payment' | 'approval' | 'system' | 'dispute'`
- `data` (JSONB, nullable) - Additional data: `{ "order_id": "...", "delivery_id": "...", "action_url": "..." }`
- `read` (BOOLEAN, DEFAULT false)
- `read_at` (TIMESTAMPTZ, nullable)
- `push_sent` (BOOLEAN, DEFAULT false) - Whether push notification was sent
- `push_sent_at` (TIMESTAMPTZ, nullable)
- `email_sent` (BOOLEAN, DEFAULT false) - Whether email was sent
- `email_sent_at` (TIMESTAMPTZ, nullable)
- `sms_sent` (BOOLEAN, DEFAULT false) - Whether SMS was sent
- `sms_sent_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Notifications are created by Edge Functions on status changes
- `read` status is updated when user views notification
- Push/email/SMS sending is handled by notification service (Edge Function or external service)
- `data` JSONB contains context for deep linking and action buttons

## Notification Templates Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `template_key` (TEXT, NOT NULL, UNIQUE) - e.g., `'order_accepted'`, `'driver_assigned'`
- `title_template` (TEXT, NOT NULL) - Template with variables: `"Order #{order_id} accepted"`
- `body_template` (TEXT, NOT NULL) - Template with variables
- `type` (TEXT, NOT NULL) - Same as notifications.type
- `default_channels` (TEXT[], NOT NULL) - `['push', 'email']` or `['push']`
- `variables` (JSONB, nullable) - Available variables: `{ "order_id": "string", "laundry_name": "string" }`
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Templates use variable substitution: `{order_id}`, `{laundry_name}`, etc.
- Templates can be disabled without deletion
- Default channels determine which notification methods to use

### Row Level Security (RLS) Policies

#### Notifications Table

1. **Users can see their own notifications**
   ```sql
   CREATE POLICY "users_see_own_notifications"
   ON notifications FOR SELECT
   TO authenticated
   USING (user_id = auth.uid());
   ```

2. **Users can update their own notifications (mark as read)**
   ```sql
   CREATE POLICY "users_update_own_notifications"
   ON notifications FOR UPDATE
   TO authenticated
   USING (user_id = auth.uid())
   WITH CHECK (user_id = auth.uid());
   ```

3. **System can create notifications (service_role)**
   - Notification creation via Edge Functions with service_role

#### Notification Templates Table

1. **Admins can manage templates**
   ```sql
   CREATE POLICY "admins_manage_templates"
   ON notification_templates FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

2. **System can read templates (service_role)**
   - Template reading via Edge Functions

### Indexes

#### Notifications Table

- Index on `user_id` for user notification queries
- Index on `read` and `created_at` for unread notifications
- Index on `type` for filtering
- Composite index on `(user_id, read, created_at DESC)` for notification list

#### Notification Templates Table

- Index on `template_key` (unique)
- Index on `is_active` for active template queries

### Triggers

- Trigger to set `read_at` when `read = true`
- Trigger to update `updated_at` on notification_templates

### Migration SQL

```sql
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order_update', 'delivery_assigned', 'payment', 'approval', 'system', 'dispute')),
  data JSONB,
  read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT false NOT NULL,
  push_sent_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false NOT NULL,
  email_sent_at TIMESTAMPTZ,
  sms_sent BOOLEAN DEFAULT false NOT NULL,
  sms_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order_update', 'delivery_assigned', 'payment', 'approval', 'system', 'dispute')),
  default_channels TEXT[] NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_created ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create trigger to set read_at
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read = true AND OLD.read = false THEN
    NEW.read_at = now();
  END IF;
  IF NEW.read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_notification_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_notification_read_at();

-- Create updated_at trigger
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Notes

- Notifications are created by Edge Functions: `send_order_notification`, `send_welcome_laundry`, etc.
- Push notifications are sent via Expo Notifications (mobile) or web push (dashboard)
- Email notifications are sent via Resend/SendGrid (Edge Function)
- SMS notifications are sent via Twilio (Edge Function)
- Notification templates allow for easy customization and i18n support
- Unread notification count is calculated via query: `COUNT(*) WHERE user_id = ? AND read = false`
