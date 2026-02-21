# Order Status History Table Schema

## Prompt

You are a Supabase database architect. Create the `order_status_history` table schema for the Laundry Marketplace Platform to track all order status transitions for audit and timeline display.

### Requirements

1. **Table Name**: `order_status_history`
2. **Primary Key**: `id` (SERIAL or UUID)
3. **Purpose**: Complete audit trail of order status changes, who performed them, and when

### Columns

- `id` (SERIAL, PRIMARY KEY) or (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL, references `orders.id` ON DELETE CASCADE)
- `from_status` (TEXT, nullable) - Previous status (NULL for initial status)
- `to_status` (TEXT, NOT NULL) - New status
- `performed_by` (UUID, nullable, references `profiles.id`) - User who triggered the change
- `performed_by_role` (TEXT, nullable) - Role of user: `'customer' | 'laundry_owner' | 'admin' | 'driver' | 'system'`
- `metadata` (JSONB, nullable) - Additional context: `{ "reason": "...", "delivery_id": "...", "note": "..." }`
- `performed_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Every status change creates a history entry
- Initial status entry: `from_status = NULL`, `to_status = 'pending'`
- `performed_by` can be NULL for system-triggered changes
- `performed_by_role = 'system'` for automated transitions (e.g., auto-dispatch)
- Metadata stores additional context (rejection reason, cancellation reason, etc.)

### Row Level Security (RLS) Policies

1. **Users can see history for their own orders**
   ```sql
   CREATE POLICY "users_see_own_order_history"
   ON order_status_history FOR SELECT
   TO authenticated
   USING (
     order_id IN (
       SELECT id FROM orders WHERE customer_id = auth.uid()
     )
   );
   ```

2. **Laundries can see history for their orders**
   ```sql
   CREATE POLICY "laundries_see_order_history"
   ON order_status_history FOR SELECT
   TO authenticated
   USING (
     order_id IN (
       SELECT id FROM orders 
       WHERE laundry_id IN (
         SELECT id FROM laundries WHERE owner_user_id = auth.uid()
       )
     )
   );
   ```

3. **Admins can see all history**
   ```sql
   CREATE POLICY "admins_see_all_history"
   ON order_status_history FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

4. **System can create history entries (service_role)**
   - History creation via Edge Functions

### Indexes

- Index on `order_id` for order timeline queries
- Index on `performed_at` for time-based queries
- Composite index on `(order_id, performed_at DESC)` for chronological timeline

### Triggers

- Trigger to automatically create history entry when `orders.status` changes
- Trigger to capture `performed_by` from current user context

### Migration SQL

```sql
-- Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_role TEXT CHECK (performed_by_role IN ('customer', 'laundry_owner', 'admin', 'driver', 'system')),
  metadata JSONB,
  performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_performed_at ON order_status_history(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_time ON order_status_history(order_id, performed_at DESC);

-- Enable RLS
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create function to log status change
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      performed_by,
      performed_by_role,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      current_setting('app.current_user_id', true)::UUID,
      current_setting('app.current_user_role', true),
      current_setting('app.status_change_metadata', true)::JSONB
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (optional - can be handled in Edge Function instead)
-- CREATE TRIGGER log_order_status_change_trigger
--   AFTER UPDATE ON orders
--   FOR EACH ROW
--   EXECUTE FUNCTION log_order_status_change();
```

### Notes

- Status history is primarily created by Edge Function `update_order_status()` with explicit logging
- Trigger-based logging is optional (can be disabled if Edge Function handles it)
- History entries are immutable (no updates/deletes)
- Timeline display uses this table to show order progress
- Metadata can include: rejection reason, cancellation reason, dispute details, etc.
- `performed_by_role` helps identify who initiated the change for UI display
