# Deliveries and Delivery Requests Table Schema

## Prompt

You are a Supabase database architect. Create the `deliveries` and `delivery_requests` table schemas for the Laundry Marketplace Platform to manage driver assignments, proof-of-delivery, and dispatch requests.

### Requirements

1. **Table Names**: `deliveries` (main table) and `delivery_requests` (dispatch queue)
2. **Primary Keys**: `id` (UUID) for both
3. **Purpose**: Track driver assignments, delivery legs (pickup/delivery), proof-of-delivery photos, OTPs, and dispatch request queue

## Deliveries Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL, references `orders.id` ON DELETE CASCADE)
- `driver_id` (UUID, nullable, references `drivers.id`) - Assigned driver
- `type` (TEXT, NOT NULL) - `'pickup' | 'delivery'`
- `status` (TEXT, NOT NULL) - Delivery-specific status
- `pickup_photo_urls` (TEXT[], nullable) - Array of proof photos from customer pickup
- `handover_photo_url` (TEXT, nullable) - Photo of handover to laundry (pickup leg)
- `return_photo_url` (TEXT, nullable) - Photo of pickup from laundry (delivery leg)
- `delivery_photo_urls` (TEXT[], nullable) - Array of proof photos for final delivery
- `signature_data` (JSONB, nullable) - `{ "signature": "base64...", "signed_at": "timestamp", "signed_by": "uuid" }`
- `otp_code` (TEXT, nullable) - 6-digit OTP for confirmation
- `otp_expires_at` (TIMESTAMPTZ, nullable)
- `note` (TEXT, nullable) - Driver notes or special instructions
- `estimated_arrival_time` (TIMESTAMPTZ, nullable) - Driver ETA
- `actual_pickup_time` (TIMESTAMPTZ, nullable)
- `actual_delivery_time` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Status Values

For `type = 'pickup'`:
- `'pending'` - Created, awaiting driver assignment
- `'assigned'` - Driver assigned
- `'in_progress'` - Driver en route to customer
- `'picked_up'` - Driver confirmed pickup
- `'at_laundry'` - Driver delivered to laundry
- `'completed'` - Pickup leg complete

For `type = 'delivery'`:
- `'pending'` - Created, awaiting driver assignment
- `'assigned'` - Driver assigned
- `'in_progress'` - Driver en route to customer
- `'delivered'` - Driver confirmed delivery
- `'completed'` - Delivery leg complete

## Delivery Requests Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `delivery_id` (UUID, NOT NULL, references `deliveries.id` ON DELETE CASCADE)
- `driver_id` (UUID, NOT NULL, references `drivers.id`)
- `status` (TEXT, NOT NULL, DEFAULT 'pending') - `'pending' | 'accepted' | 'rejected' | 'expired'`
- `expires_at` (TIMESTAMPTZ, NOT NULL) - Request expiry (3 minutes from creation)
- `rejection_reason` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Each delivery can have multiple `delivery_requests` (up to 5) for first-accept-wins dispatch
- Only one request per delivery can be `'accepted'` (enforced via unique constraint or application logic)
- Requests expire after 3 minutes
- When a request is accepted, all other pending requests for the same delivery are marked as `'expired'`
- Driver can only accept if `status = 'pending'` and `expires_at > now()`

### Row Level Security (RLS) Policies

#### Deliveries Table

1. **Drivers can see their assigned deliveries**
   ```sql
   CREATE POLICY "drivers_see_assigned_deliveries"
   ON deliveries FOR SELECT
   TO authenticated
   USING (
     driver_id IN (
       SELECT id FROM drivers WHERE user_id = auth.uid()
     )
   );
   ```

2. **Customers can see deliveries for their orders**
   ```sql
   CREATE POLICY "customers_see_order_deliveries"
   ON deliveries FOR SELECT
   TO authenticated
   USING (
     order_id IN (
       SELECT id FROM orders WHERE customer_id = auth.uid()
     )
   );
   ```

3. **Laundries can see deliveries for their orders**
   ```sql
   CREATE POLICY "laundries_see_order_deliveries"
   ON deliveries FOR SELECT
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

4. **Admins can see all deliveries**
   ```sql
   CREATE POLICY "admins_see_all_deliveries"
   ON deliveries FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

#### Delivery Requests Table

1. **Drivers can see requests sent to them**
   ```sql
   CREATE POLICY "drivers_see_own_requests"
   ON delivery_requests FOR SELECT
   TO authenticated
   USING (
     driver_id IN (
       SELECT id FROM drivers WHERE user_id = auth.uid()
     )
   );
   ```

2. **System/Edge Functions can manage requests (service_role)**
   - Request creation and updates via Edge Functions

### Indexes

#### Deliveries Table

- Index on `order_id` for order lookups
- Index on `driver_id` for driver delivery history
- Index on `type` and `status` for filtering
- Composite index on `(driver_id, status)` for driver active deliveries
- Composite index on `(order_id, type)` for order delivery legs

#### Delivery Requests Table

- Index on `delivery_id` for delivery lookups
- Index on `driver_id` for driver request history
- Index on `status` and `expires_at` for expired request cleanup
- Composite index on `(delivery_id, status)` for first-accept-wins queries

### Triggers

- `updated_at` trigger on deliveries
- Trigger to auto-expire delivery_requests after `expires_at`
- Trigger to update driver's `current_load` when delivery status changes

### Migration SQL

```sql
-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('pickup', 'delivery')),
  status TEXT NOT NULL,
  pickup_photo_urls TEXT[],
  handover_photo_url TEXT,
  return_photo_url TEXT,
  delivery_photo_urls TEXT[],
  signature_data JSONB,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  note TEXT,
  estimated_arrival_time TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create delivery_requests table
CREATE TABLE IF NOT EXISTS delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_type_status ON deliveries(type, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status ON deliveries(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_type ON deliveries(order_id, type);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_delivery ON delivery_requests(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status_expires ON delivery_requests(status, expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-expire delivery requests
CREATE OR REPLACE FUNCTION expire_delivery_requests()
RETURNS void AS $$
BEGIN
  UPDATE delivery_requests
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule auto-expiry (run via cron or Edge Function)
```

### Notes

- Photo URLs must be valid Supabase Storage signed URLs
- OTP codes are 6-digit numeric, generated on driver assignment
- OTP expires after 10 minutes
- Signature data stores base64-encoded signature image
- First-accept-wins logic: first driver to accept gets assignment, others expire
- Delivery requests are created by `dispatch_driver` Edge Function
- Status updates trigger real-time notifications via Supabase Realtime
