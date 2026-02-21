# Orders and Order Items Table Schema

## Prompt

You are a Supabase database architect. Create the `orders` and `order_items` table schemas for the Laundry Marketplace Platform to manage customer orders, order status machine, and order line items.

### Requirements

1. **Table Names**: `orders` (main table) and `order_items` (line items)
2. **Primary Keys**: `id` (UUID) for both
3. **Purpose**: Store customer orders, status tracking, pricing, and service line items

## Orders Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `customer_id` (UUID, NOT NULL, references `profiles.id`)
- `laundry_id` (UUID, NOT NULL, references `laundries.id`)
- `status` (TEXT, NOT NULL) - Full status machine enum (see below)
- `total_price` (NUMERIC(10, 2), NOT NULL) - Total order amount
- `service_fee` (NUMERIC(10, 2), DEFAULT 0.00) - Platform service fee
- `pickup_fee` (NUMERIC(10, 2), DEFAULT 0.00) - Pickup/delivery fee
- `commission_amount` (NUMERIC(10, 2), DEFAULT 0.00) - Platform commission (15% default)
- `platform_fee` (NUMERIC(10, 2), DEFAULT 0.00) - Fixed platform fee (R15 default)
- `pickup_address` (TEXT, NOT NULL)
- `pickup_latitude` (NUMERIC(10, 8), NOT NULL)
- `pickup_longitude` (NUMERIC(11, 8), NOT NULL)
- `dropoff_address` (TEXT, NOT NULL) - Same as pickup for MVP, but separate for future
- `dropoff_latitude` (NUMERIC(10, 8), NOT NULL)
- `dropoff_longitude` (NUMERIC(11, 8), NOT NULL)
- `scheduled_pickup_time` (TIMESTAMPTZ, NOT NULL) - Customer's preferred pickup time
- `estimated_completion_time` (TIMESTAMPTZ, nullable) - Laundry's estimated completion
- `total_weight_kg` (NUMERIC(5, 2), NOT NULL) - Total weight in kg
- `special_notes` (TEXT, nullable) - Customer special instructions
- `cancellation_reason` (TEXT, nullable)
- `cancelled_at` (TIMESTAMPTZ, nullable)
- `cancelled_by` (UUID, nullable, references `profiles.id`)
- `completed_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Status Machine

```sql
status TEXT NOT NULL CHECK (status IN (
  'pending',
  'laundry_requested',
  'accepted',
  'rejected',
  'driver_pickup_assigned',
  'pickup_in_progress',
  'picked_up',
  'at_laundry',
  'washing_in_progress',
  'ready_for_delivery',
  'driver_delivery_assigned',
  'delivery_in_progress',
  'completed',
  'cancelled',
  'disputed'
))
```

### Allowed Status Transitions

- `pending` → `laundry_requested` (on payment success)
- `laundry_requested` → `accepted` OR `rejected` (laundry within 30 min)
- `accepted` → `driver_pickup_assigned` (auto-dispatch)
- `driver_pickup_assigned` → `pickup_in_progress` (driver accepts)
- `pickup_in_progress` → `picked_up` (driver confirms)
- `picked_up` → `at_laundry` (driver drops off)
- `at_laundry` → `washing_in_progress` (laundry starts)
- `washing_in_progress` → `ready_for_delivery` (laundry finishes)
- `ready_for_delivery` → `driver_delivery_assigned` (auto-dispatch)
- `driver_delivery_assigned` → `delivery_in_progress` (driver accepts)
- `delivery_in_progress` → `completed` (driver confirms delivery)
- Any status → `cancelled` (with 10% fee if before washing)
- Any status (except completed) → `disputed`

## Order Items Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL, references `orders.id` ON DELETE CASCADE)
- `service_type` (TEXT, NOT NULL) - `'wash_and_fold' | 'dry_clean' | 'iron_only' | 'express'`
- `quantity` (NUMERIC(5, 2), NOT NULL) - kg for wash&fold, count for items
- `unit_price` (NUMERIC(10, 2), NOT NULL) - Price per unit
- `total_price` (NUMERIC(10, 2), NOT NULL) - quantity * unit_price
- `description` (TEXT, nullable) - Item description
- `created_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Each order must have at least one order_item
- `total_price` in orders = sum of order_items.total_price + fees
- Service types must match laundry's `services_offered`
- Quantity must be > 0

### Row Level Security (RLS) Policies

#### Orders Table

1. **Customers can see their own orders**
   ```sql
   CREATE POLICY "customers_see_own_orders"
   ON orders FOR SELECT
   TO authenticated
   USING (customer_id = auth.uid());
   ```

2. **Laundries can see orders assigned to them**
   ```sql
   CREATE POLICY "laundries_see_own_orders"
   ON orders FOR ALL
   TO authenticated
   USING (
     laundry_id IN (
       SELECT id FROM laundries WHERE owner_user_id = auth.uid() AND status = 'active'
     )
   );
   ```

3. **Admins can see all orders**
   ```sql
   CREATE POLICY "admins_see_all_orders"
   ON orders FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

4. **Drivers can see orders via deliveries table (indirect access)**
   - Access through `deliveries` table joins

#### Order Items Table

1. **Same RLS as orders (inherited via order_id)**
   ```sql
   CREATE POLICY "order_items_follow_order_access"
   ON order_items FOR SELECT
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM orders WHERE id = order_items.order_id
       AND (
         customer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM laundries 
           WHERE id = orders.laundry_id AND owner_user_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
         )
       )
     )
   );
   ```

### Indexes

#### Orders Table

- Index on `customer_id` for customer order history
- Index on `laundry_id` for laundry order management
- Index on `status` for status filtering
- Index on `created_at` for time-based queries
- Composite index on `(laundry_id, status)` for laundry dashboard
- Composite index on `(customer_id, status)` for customer app

#### Order Items Table

- Index on `order_id` for order detail queries
- Index on `service_type` for analytics

### Triggers

- `updated_at` trigger on orders
- Trigger to validate status transitions (enforced via Edge Function, but can add DB constraint)
- Trigger to calculate `total_price` from order_items (or handle in application)

### Migration SQL

```sql
-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  laundry_id UUID NOT NULL REFERENCES laundries(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'laundry_requested', 'accepted', 'rejected',
    'driver_pickup_assigned', 'pickup_in_progress', 'picked_up',
    'at_laundry', 'washing_in_progress', 'ready_for_delivery',
    'driver_delivery_assigned', 'delivery_in_progress',
    'completed', 'cancelled', 'disputed'
  )),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  service_fee NUMERIC(10, 2) DEFAULT 0.00 CHECK (service_fee >= 0),
  pickup_fee NUMERIC(10, 2) DEFAULT 0.00 CHECK (pickup_fee >= 0),
  commission_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (commission_amount >= 0),
  platform_fee NUMERIC(10, 2) DEFAULT 0.00 CHECK (platform_fee >= 0),
  pickup_address TEXT NOT NULL,
  pickup_latitude NUMERIC(10, 8) NOT NULL,
  pickup_longitude NUMERIC(11, 8) NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_latitude NUMERIC(10, 8) NOT NULL,
  dropoff_longitude NUMERIC(11, 8) NOT NULL,
  scheduled_pickup_time TIMESTAMPTZ NOT NULL,
  estimated_completion_time TIMESTAMPTZ,
  total_weight_kg NUMERIC(5, 2) NOT NULL CHECK (total_weight_kg > 0),
  special_notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('wash_and_fold', 'dry_clean', 'iron_only', 'express')),
  quantity NUMERIC(5, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_laundry ON orders(laundry_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_laundry_status ON orders(laundry_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_service_type ON order_items(service_type);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Notes

- Status transitions are enforced via Edge Function `update_order_status()` with validation
- Total price calculation: sum(order_items.total_price) + service_fee + pickup_fee
- Commission is calculated on completion (15% of total_price by default)
- Cancellation fee (10%) is deducted if cancelled before washing starts
- Geographic queries use coordinates for distance calculations
- Order creation triggers capacity deduction from laundry's daily capacity
