# Laundries Table Schema

## Prompt

You are a Supabase database architect. Create the `laundries` table schema for the Laundry Marketplace Platform to store laundry partner (laundromat) information and business details.

### Requirements

1. **Table Name**: `laundries`
2. **Primary Key**: `id` (UUID)
3. **Purpose**: Store laundry partner business information, approval status, capacity, and operational details

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `owner_user_id` (UUID, NOT NULL, references `profiles.id`)
- `business_name` (TEXT, NOT NULL)
- `owner_name` (TEXT, NOT NULL)
- `email` (TEXT, NOT NULL)
- `phone` (TEXT, NOT NULL)
- `physical_address` (TEXT, NOT NULL)
- `latitude` (NUMERIC(10, 8), NOT NULL)
- `longitude` (NUMERIC(11, 8), NOT NULL)
- `status` (TEXT, NOT NULL, CHECK constraint: `'pending_approval' | 'active' | 'rejected' | 'more_info_needed'`)
- `rejection_reason` (TEXT, nullable)
- `services_offered` (JSONB, NOT NULL) - Array of service types: `['wash_and_fold', 'dry_clean', 'iron_only', 'express']`
- `price_per_kg` (NUMERIC(10, 2), NOT NULL)
- `capacity_per_day` (INTEGER, NOT NULL) - Maximum kg capacity per day
- `operating_hours` (JSONB, NOT NULL) - `{ "monday": { "open": "08:00", "close": "18:00" }, ... }`
- `bank_details` (JSONB, nullable) - Encrypted or secure field: `{ "account_number": "...", "bank_name": "...", "account_holder": "..." }`
- `photos` (TEXT[], nullable) - Array of Supabase Storage URLs
- `rating` (NUMERIC(3, 2), DEFAULT 0.00) - Average rating (0.00 to 5.00)
- `total_reviews` (INTEGER, DEFAULT 0)
- `is_verified` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Only users with `role = 'laundry_owner'` can create laundry records
- Status must be `'pending_approval'` on initial creation
- Only `status = 'active'` laundries appear in customer searches
- Latitude/longitude must be valid coordinates (within South Africa bounds for MVP)
- `capacity_per_day` must be > 0
- `price_per_kg` must be > 0
- Photos must be valid Supabase Storage signed URLs
- Rating is calculated from reviews (separate table)

### Row Level Security (RLS) Policies

1. **Laundry owners can manage their own laundry (if pending or active)**
   ```sql
   CREATE POLICY "laundry_owners_manage_own_profile"
   ON laundries FOR ALL
   TO authenticated
   USING (
     owner_user_id = auth.uid()
     AND status IN ('pending_approval', 'active', 'more_info_needed')
   );
   ```

2. **Public can only see active laundries**
   ```sql
   CREATE POLICY "public_see_active_laundries"
   ON laundries FOR SELECT
   TO authenticated, anon
   USING (status = 'active');
   ```

3. **Admins can see all laundries**
   ```sql
   CREATE POLICY "admins_see_all_laundries"
   ON laundries FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

4. **Pending applications visible to owner and admins**
   ```sql
   CREATE POLICY "pending_visible_to_admin_and_owner"
   ON laundries FOR SELECT
   TO authenticated
   USING (
     status = 'pending_approval'
     AND (
       owner_user_id = auth.uid()
       OR EXISTS (
         SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
       )
     )
   );
   ```

### Indexes

- Index on `status` for filtering by approval status
- Index on `owner_user_id` for owner lookups
- GIST index on `(latitude, longitude)` for geographic queries (Haversine distance calculations)
- Index on `is_verified` and `rating` for sorting/filtering

### Triggers

- `updated_at` trigger
- Trigger to validate coordinates on insert/update

### Migration SQL

```sql
-- Create laundries table
CREATE TABLE IF NOT EXISTS laundries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  physical_address TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'active', 'rejected', 'more_info_needed')),
  rejection_reason TEXT,
  services_offered JSONB NOT NULL,
  price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg > 0),
  capacity_per_day INTEGER NOT NULL CHECK (capacity_per_day > 0),
  operating_hours JSONB NOT NULL,
  bank_details JSONB,
  photos TEXT[],
  rating NUMERIC(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5.00),
  total_reviews INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_laundries_status ON laundries(status);
CREATE INDEX IF NOT EXISTS idx_laundries_owner ON laundries(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_laundries_location ON laundries USING GIST (point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_laundries_verified_rating ON laundries(is_verified, rating DESC);

-- Enable RLS
ALTER TABLE laundries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE TRIGGER update_laundries_updated_at
  BEFORE UPDATE ON laundries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Notes

- Geographic queries use PostGIS or Haversine formula for distance calculations
- Bank details should be encrypted at application level or use Supabase Vault
- Photos array stores signed URLs from Supabase Storage
- Status transitions are managed via Edge Functions (`approve_laundry_partner`, `reject_laundry_partner`)
- Capacity management is handled separately via `capacity_logs` table
