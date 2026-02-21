# Delivery Issues Table Schema

## Prompt

You are a Supabase database architect. Create the `delivery_issues` table schema for the Laundry Marketplace Platform to track issues reported during deliveries by any party (driver, laundry, customer).

### Requirements

1. **Table Name**: `delivery_issues`
2. **Primary Key**: `id` (UUID)
3. **Purpose**: Track delivery problems, disputes, and issues reported during pickup/delivery

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `delivery_id` (UUID, NOT NULL, references `deliveries.id` ON DELETE CASCADE)
- `order_id` (UUID, NOT NULL, references `orders.id` ON DELETE CASCADE) - Denormalized for easier queries
- `reported_by` (UUID, NOT NULL, references `profiles.id`)
- `reported_by_role` (TEXT, NOT NULL) - `'customer' | 'laundry_owner' | 'driver'`
- `reason` (TEXT, NOT NULL) - Issue category: `'damaged_bag' | 'wrong_address' | 'customer_not_home' | 'missing_items' | 'late_delivery' | 'other'`
- `description` (TEXT, NOT NULL) - Detailed description
- `photo_urls` (TEXT[], nullable) - Array of proof photos
- `details` (JSONB, nullable) - Additional context: `{ "estimated_delay": "...", "contact_attempts": 3 }`
- `severity` (TEXT, NOT NULL, DEFAULT 'medium') - `'low' | 'medium' | 'high' | 'critical'`
- `status` (TEXT, NOT NULL, DEFAULT 'open') - `'open' | 'investigating' | 'resolved' | 'dismissed'`
- `resolved_by` (UUID, nullable, references `profiles.id`) - Admin who resolved
- `resolved_at` (TIMESTAMPTZ, nullable)
- `resolution_notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Any party can report issues during active delivery
- Critical issues (e.g., damaged items) can trigger order status → `'disputed'`
- Issues are visible to all parties involved (customer, laundry, driver, admin)
- Resolution is handled by admins
- Photo URLs must be valid Supabase Storage signed URLs

### Row Level Security (RLS) Policies

1. **Reporters can see their own issues**
   ```sql
   CREATE POLICY "users_see_own_issues"
   ON delivery_issues FOR SELECT
   TO authenticated
   USING (reported_by = auth.uid());
   ```

2. **All parties can see issues for their orders/deliveries**
   ```sql
   CREATE POLICY "parties_see_order_issues"
   ON delivery_issues FOR SELECT
   TO authenticated
   USING (
     order_id IN (
       SELECT id FROM orders 
       WHERE customer_id = auth.uid()
       OR laundry_id IN (
         SELECT id FROM laundries WHERE owner_user_id = auth.uid()
       )
     )
     OR delivery_id IN (
       SELECT id FROM deliveries 
       WHERE driver_id IN (
         SELECT id FROM drivers WHERE user_id = auth.uid()
       )
     )
   );
   ```

3. **Admins can see and manage all issues**
   ```sql
   CREATE POLICY "admins_manage_all_issues"
   ON delivery_issues FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

### Indexes

- Index on `delivery_id` for delivery-linked issues
- Index on `order_id` for order-linked issues
- Index on `reported_by` for reporter queries
- Index on `status` and `severity` for filtering
- Composite index on `(status, severity, created_at DESC)` for admin dashboard

### Triggers

- `updated_at` trigger
- Trigger to set order status to `'disputed'` if severity = `'critical'`

### Migration SQL

```sql
-- Create delivery_issues table
CREATE TABLE IF NOT EXISTS delivery_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reported_by_role TEXT NOT NULL CHECK (reported_by_role IN ('customer', 'laundry_owner', 'driver')),
  reason TEXT NOT NULL CHECK (reason IN ('damaged_bag', 'wrong_address', 'customer_not_home', 'missing_items', 'late_delivery', 'other')),
  description TEXT NOT NULL,
  photo_urls TEXT[],
  details JSONB,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_issues_delivery ON delivery_issues(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_order ON delivery_issues(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_reported_by ON delivery_issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_status_severity ON delivery_issues(status, severity, created_at DESC);

-- Enable RLS
ALTER TABLE delivery_issues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE TRIGGER update_delivery_issues_updated_at
  BEFORE UPDATE ON delivery_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to set order to disputed on critical issue
CREATE OR REPLACE FUNCTION check_critical_issue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' AND NEW.status = 'open' THEN
    UPDATE orders
    SET status = 'disputed'
    WHERE id = NEW.order_id
    AND status != 'disputed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_critical_issue_trigger
  AFTER INSERT OR UPDATE ON delivery_issues
  FOR EACH ROW
  EXECUTE FUNCTION check_critical_issue();
```

### Notes

- Issues are created by Edge Function `report_delivery_issue()`
- Critical issues automatically trigger order dispute status
- Photo evidence is required for certain issue types (damaged_bag, missing_items)
- Resolution workflow: admin investigates → resolves → notifies all parties
- Issues can be linked to disputes table (if separate disputes table exists)
