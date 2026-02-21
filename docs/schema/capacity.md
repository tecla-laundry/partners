# Capacity Logs Table Schema

## Prompt

You are a Supabase database architect. Create the `capacity_logs` table schema for the Laundry Marketplace Platform to track daily capacity usage for laundry partners.

### Requirements

1. **Table Name**: `capacity_logs`
2. **Primary Key**: `id` (UUID)
3. **Purpose**: Audit trail of daily capacity usage, capacity deductions on order acceptance, and capacity resets

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `laundry_id` (UUID, NOT NULL, references `laundries.id`)
- `date` (DATE, NOT NULL) - The date this capacity log entry is for
- `total_capacity_kg` (INTEGER, NOT NULL) - Total capacity for the day (from laundries.capacity_per_day)
- `used_capacity_kg` (INTEGER, NOT NULL, DEFAULT 0) - Used capacity in kg
- `remaining_capacity_kg` (INTEGER, NOT NULL) - Calculated: total_capacity_kg - used_capacity_kg
- `order_id` (UUID, nullable, references `orders.id`) - Order that triggered this capacity change
- `action` (TEXT, NOT NULL) - `'deduct' | 'reset' | 'adjust'`
- `amount_kg` (NUMERIC(5, 2), NOT NULL) - Amount of capacity change
- `notes` (TEXT, nullable) - Optional notes about the capacity change
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- One row per laundry per day (or multiple rows if capacity is adjusted)
- Capacity is deducted when order is accepted (`action = 'deduct'`)
- Capacity resets at midnight via cron job (`action = 'reset'`)
- `remaining_capacity_kg` must be >= 0
- `used_capacity_kg` = sum of all `amount_kg` where `action = 'deduct'` for that day
- Capacity check happens before order acceptance (Edge Function validates)

### Row Level Security (RLS) Policies

1. **Laundries can see their own capacity logs**
   ```sql
   CREATE POLICY "laundries_see_own_capacity_logs"
   ON capacity_logs FOR SELECT
   TO authenticated
   USING (
     laundry_id IN (
       SELECT id FROM laundries WHERE owner_user_id = auth.uid()
     )
   );
   ```

2. **Admins can see all capacity logs**
   ```sql
   CREATE POLICY "admins_see_all_capacity_logs"
   ON capacity_logs FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

3. **System can create capacity logs (service_role)**
   - Capacity log creation via Edge Functions

### Indexes

- Index on `laundry_id` and `date` for daily capacity queries
- Composite index on `(laundry_id, date DESC)` for capacity history
- Index on `order_id` for order-linked capacity changes

### Triggers

- Trigger to calculate `remaining_capacity_kg` automatically
- Trigger to validate `remaining_capacity_kg >= 0`

### Migration SQL

```sql
-- Create capacity_logs table
CREATE TABLE IF NOT EXISTS capacity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES laundries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_capacity_kg INTEGER NOT NULL CHECK (total_capacity_kg > 0),
  used_capacity_kg INTEGER NOT NULL DEFAULT 0 CHECK (used_capacity_kg >= 0),
  remaining_capacity_kg INTEGER NOT NULL CHECK (remaining_capacity_kg >= 0),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('deduct', 'reset', 'adjust')),
  amount_kg NUMERIC(5, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_capacity_logs_laundry_date ON capacity_logs(laundry_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_logs_order ON capacity_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_capacity_logs_laundry_date_action ON capacity_logs(laundry_id, date, action);

-- Enable RLS
ALTER TABLE capacity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create function to get current day's capacity
CREATE OR REPLACE FUNCTION get_laundry_capacity_today(laundry_uuid UUID)
RETURNS TABLE (
  total_capacity_kg INTEGER,
  used_capacity_kg INTEGER,
  remaining_capacity_kg INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.total_capacity_kg,
    cl.used_capacity_kg,
    cl.remaining_capacity_kg
  FROM capacity_logs cl
  WHERE cl.laundry_id = laundry_uuid
    AND cl.date = CURRENT_DATE
    AND cl.action = 'reset'
  ORDER BY cl.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

### Notes

- Capacity logs are created by Edge Functions: `accept_order` (deduct), daily cron (reset)
- Daily capacity reset runs at midnight via scheduled Edge Function
- Capacity check happens before order acceptance (validate `remaining_capacity_kg >= order.total_weight_kg`)
- Historical capacity data is preserved for analytics
- Capacity can be manually adjusted by admins (creates log entry with `action = 'adjust'`)
