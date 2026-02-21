# Drivers Table Schema

## Prompt

You are a Supabase database architect. Create the `drivers` table schema for the Laundry Marketplace Platform to store independent driver information, location tracking, and performance metrics.

### Requirements

1. **Table Name**: `drivers`
2. **Primary Key**: `id` (UUID)
3. **Purpose**: Store driver profile, real-time location, availability status, and performance metrics for dispatch matching

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id` (UUID, NOT NULL, UNIQUE, references `profiles.id`)
- `vehicle_type` (TEXT, NOT NULL) - `'motorcycle' | 'car' | 'van' | 'bicycle'`
- `vehicle_registration` (TEXT, NOT NULL)
- `license_number` (TEXT, NOT NULL)
- `license_expiry` (DATE, nullable)
- `current_latitude` (NUMERIC(10, 8), nullable)
- `current_longitude` (NUMERIC(11, 8), nullable)
- `last_location_updated_at` (TIMESTAMPTZ, nullable)
- `is_active` (BOOLEAN, DEFAULT false) - Online/offline status
- `rating` (NUMERIC(3, 2), DEFAULT 0.00) - Average rating (0.00 to 5.00)
- `total_deliveries` (INTEGER, DEFAULT 0)
- `acceptance_rate` (NUMERIC(5, 2), DEFAULT 0.00) - Percentage (0.00 to 100.00)
- `on_time_percentage` (NUMERIC(5, 2), DEFAULT 0.00) - Percentage (0.00 to 100.00)
- `current_load` (INTEGER, DEFAULT 0) - Number of active deliveries
- `bank_details` (JSONB, nullable) - `{ "account_number": "...", "bank_name": "...", "account_holder": "..." }`
- `profile_photo_url` (TEXT, nullable) - Supabase Storage URL
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Only users with `role = 'driver'` can have a driver record
- `is_active = true` enables location tracking and dispatch eligibility
- Location updates only when `is_active = true`
- `current_load` is automatically managed (incremented on assignment, decremented on completion)
- `acceptance_rate` = (accepted requests / total requests) * 100
- `on_time_percentage` = (on-time deliveries / total deliveries) * 100
- Rating is calculated from delivery reviews
- Vehicle registration must be unique

### Row Level Security (RLS) Policies

1. **Drivers can read/update their own record**
   ```sql
   CREATE POLICY "drivers_manage_own_profile"
   ON drivers FOR ALL
   TO authenticated
   USING (user_id = auth.uid());
   ```

2. **Admins can read all drivers**
   ```sql
   CREATE POLICY "admins_read_all_drivers"
   ON drivers FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

3. **System/Edge Functions can update location (service_role)**
   - Location updates should be done via Edge Functions with service_role key
   - RLS policies should allow location updates when driver is active

4. **Customers/Laundries can see limited driver info when assigned to their order**
   - Implemented via joins through `deliveries` table, not direct access

### Indexes

- Index on `user_id` (unique)
- Index on `is_active` for dispatch queries
- GIST index on `(current_longitude, current_latitude)` for geographic queries
- Index on `rating` and `acceptance_rate` for dispatch sorting
- Index on `current_load` for filtering available drivers

### Triggers

- `updated_at` trigger
- Trigger to update `last_location_updated_at` when location changes
- Trigger to validate coordinates

### Migration SQL

```sql
-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('motorcycle', 'car', 'van', 'bicycle')),
  vehicle_registration TEXT NOT NULL UNIQUE,
  license_number TEXT NOT NULL,
  license_expiry DATE,
  current_latitude NUMERIC(10, 8),
  current_longitude NUMERIC(11, 8),
  last_location_updated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false NOT NULL,
  rating NUMERIC(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5.00),
  total_deliveries INTEGER DEFAULT 0 CHECK (total_deliveries >= 0),
  acceptance_rate NUMERIC(5, 2) DEFAULT 0.00 CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100.00),
  on_time_percentage NUMERIC(5, 2) DEFAULT 0.00 CHECK (on_time_percentage >= 0 AND on_time_percentage <= 100.00),
  current_load INTEGER DEFAULT 0 CHECK (current_load >= 0),
  bank_details JSONB,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers USING GIST (point(current_longitude, current_latitude)) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_rating_acceptance ON drivers(rating DESC, acceptance_rate DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_current_load ON drivers(current_load) WHERE is_active = true;

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update last_location_updated_at
CREATE OR REPLACE FUNCTION update_driver_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_latitude IS DISTINCT FROM NEW.current_latitude 
     OR OLD.current_longitude IS DISTINCT FROM NEW.current_longitude THEN
    NEW.last_location_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_location_timestamp
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_location_timestamp();
```

### Notes

- Location updates should be throttled (e.g., max once per 30 seconds) to prevent excessive writes
- Background location tracking only when `is_active = true`
- Dispatch algorithm uses: distance (40%) + rating (30%) + acceptance_rate (30%)
- `current_load` prevents over-assignment (max 3-5 concurrent deliveries per driver)
- Bank details should be encrypted at application level
- License expiry should trigger warnings/notifications when approaching expiration
