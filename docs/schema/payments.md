# Payments and Payouts Table Schema

## Prompt

You are a Supabase database architect. Create the `payments` and `payouts` table schemas for the Laundry Marketplace Platform to manage customer payments, escrow, commissions, and partner/driver payouts.

### Requirements

1. **Table Names**: `payments` (customer payments) and `payouts` (partner/driver payouts)
2. **Primary Keys**: `id` (UUID) for both
3. **Purpose**: Track customer payments, escrow holds, commission calculations, and batch payouts to laundries and drivers

## Payments Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `order_id` (UUID, NOT NULL, UNIQUE, references `orders.id`)
- `customer_id` (UUID, NOT NULL, references `profiles.id`)
- `amount` (NUMERIC(10, 2), NOT NULL) - Total payment amount
- `currency` (TEXT, NOT NULL, DEFAULT 'ZAR') - South African Rand
- `payment_method` (TEXT, NOT NULL) - `'paystack' | 'yoco' | 'payfast'`
- `payment_provider_transaction_id` (TEXT, nullable) - External payment gateway transaction ID
- `status` (TEXT, NOT NULL) - `'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded'`
- `escrow_status` (TEXT, NOT NULL, DEFAULT 'held') - `'held' | 'released' | 'refunded'`
- `commission_amount` (NUMERIC(10, 2), DEFAULT 0.00) - Platform commission (15% default)
- `platform_fee` (NUMERIC(10, 2), DEFAULT 0.00) - Fixed platform fee (R15 default)
- `laundry_payout_amount` (NUMERIC(10, 2), DEFAULT 0.00) - Amount to pay laundry (amount - commission - platform_fee)
- `driver_payout_amount` (NUMERIC(10, 2), DEFAULT 0.00) - Amount to pay driver (separate from order)
- `refund_amount` (NUMERIC(10, 2), DEFAULT 0.00) - Refunded amount if cancelled/disputed
- `refund_reason` (TEXT, nullable)
- `webhook_payload` (JSONB, nullable) - Raw webhook data from payment provider
- `webhook_processed_at` (TIMESTAMPTZ, nullable)
- `paid_at` (TIMESTAMPTZ, nullable)
- `released_at` (TIMESTAMPTZ, nullable) - When escrow was released
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- One payment per order (1:1 relationship)
- Payment is created when customer confirms order (before Edge Function `create_order`)
- `escrow_status = 'held'` until order is completed or cancelled
- On completion: `escrow_status = 'released'`, `laundry_payout_amount` calculated
- On cancellation: `escrow_status = 'refunded'` (90% refund, 10% platform fee)
- Commission is calculated on order completion (15% of total_price by default)
- Platform fee is fixed (R15) per order
- Driver payout is separate (base fee + distance + tip)

## Payouts Table

### Columns

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid())
- `recipient_type` (TEXT, NOT NULL) - `'laundry' | 'driver'`
- `recipient_id` (UUID, NOT NULL) - References `laundries.id` or `drivers.id`
- `payment_id` (UUID, nullable, references `payments.id`) - For laundry payouts linked to order
- `delivery_id` (UUID, nullable, references `deliveries.id`) - For driver payouts linked to delivery
- `amount` (NUMERIC(10, 2), NOT NULL) - Payout amount
- `currency` (TEXT, NOT NULL, DEFAULT 'ZAR')
- `status` (TEXT, NOT NULL, DEFAULT 'pending') - `'pending' | 'processing' | 'completed' | 'failed'`
- `period_start` (DATE, nullable) - Start of payout period (for batch payouts)
- `period_end` (DATE, nullable) - End of payout period
- `bank_account_details` (JSONB, nullable) - Encrypted bank details
- `payout_provider_transaction_id` (TEXT, nullable) - External payout transaction ID
- `processed_at` (TIMESTAMPTZ, nullable)
- `failure_reason` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, DEFAULT now())
- `updated_at` (TIMESTAMPTZ, DEFAULT now())

### Business Rules

- Payouts are created when order is completed (laundry) or delivery is completed (driver)
- Batch payouts run weekly via `process_payouts` Edge Function
- Status `'pending'` until batch processing
- Bank account details retrieved from `laundries.bank_details` or `drivers.bank_details`
- Failed payouts can be retried

### Row Level Security (RLS) Policies

#### Payments Table

1. **Customers can see their own payments**
   ```sql
   CREATE POLICY "customers_see_own_payments"
   ON payments FOR SELECT
   TO authenticated
   USING (customer_id = auth.uid());
   ```

2. **Laundries can see payments for their orders**
   ```sql
   CREATE POLICY "laundries_see_order_payments"
   ON payments FOR SELECT
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

3. **Admins can see all payments**
   ```sql
   CREATE POLICY "admins_see_all_payments"
   ON payments FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

#### Payouts Table

1. **Laundries can see their own payouts**
   ```sql
   CREATE POLICY "laundries_see_own_payouts"
   ON payouts FOR SELECT
   TO authenticated
   USING (
     recipient_type = 'laundry'
     AND recipient_id IN (
       SELECT id FROM laundries WHERE owner_user_id = auth.uid()
     )
   );
   ```

2. **Drivers can see their own payouts**
   ```sql
   CREATE POLICY "drivers_see_own_payouts"
   ON payouts FOR SELECT
   TO authenticated
   USING (
     recipient_type = 'driver'
     AND recipient_id IN (
       SELECT id FROM drivers WHERE user_id = auth.uid()
     )
   );
   ```

3. **Admins can see all payouts**
   ```sql
   CREATE POLICY "admins_see_all_payouts"
   ON payouts FOR ALL
   TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

### Indexes

#### Payments Table

- Index on `order_id` (unique)
- Index on `customer_id` for customer payment history
- Index on `status` and `escrow_status` for payment processing
- Index on `payment_provider_transaction_id` for webhook lookups
- Index on `created_at` for time-based queries

#### Payouts Table

- Index on `recipient_type` and `recipient_id` for recipient lookups
- Index on `status` for payout processing
- Index on `period_start` and `period_end` for batch queries
- Composite index on `(recipient_type, recipient_id, status)`

### Triggers

- `updated_at` trigger on both tables
- Trigger to calculate `laundry_payout_amount` on payment creation
- Trigger to update `escrow_status` when order status changes

### Migration SQL

```sql
-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack', 'yoco', 'payfast')),
  payment_provider_transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')),
  escrow_status TEXT NOT NULL DEFAULT 'held' CHECK (escrow_status IN ('held', 'released', 'refunded')),
  commission_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (commission_amount >= 0),
  platform_fee NUMERIC(10, 2) DEFAULT 0.00 CHECK (platform_fee >= 0),
  laundry_payout_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (laundry_payout_amount >= 0),
  driver_payout_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (driver_payout_amount >= 0),
  refund_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (refund_amount >= 0),
  refund_reason TEXT,
  webhook_payload JSONB,
  webhook_processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('laundry', 'driver')),
  recipient_id UUID NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_start DATE,
  period_end DATE,
  bank_account_details JSONB,
  payout_provider_transaction_id TEXT,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, escrow_status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_txn ON payments(payment_provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON payouts(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient_status ON payouts(recipient_type, recipient_id, status);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (see above)

-- Create updated_at triggers
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Notes

- Payment webhooks are processed by `handle_payment_webhook` Edge Function
- Escrow is held in payment provider's merchant balance (Paystack/Yoco)
- Commission rate is configurable (default 15%, can be overridden per laundry)
- Refunds are processed via payment provider API
- Payouts are batched weekly via `process_payouts` Edge Function
- Bank details should be encrypted at application level
- Payment provider transaction IDs are used for reconciliation
