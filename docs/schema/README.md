# Database Schema Prompts

This directory contains markdown prompts for creating all database tables for the Laundry Marketplace Platform. Each file contains a complete prompt that can be used to generate the table schema, including columns, constraints, indexes, RLS policies, and migration SQL.

## Table Schema Files

### Core User & Partner Tables

1. **[profiles.md](./profiles.md)** - User profiles extending Supabase Auth
   - Extends `auth.users` with role-based access control
   - Roles: `customer`, `laundry_owner`, `admin`, `driver`

2. **[laundries.md](./laundries.md)** - Laundry partner business information
   - Approval workflow: `pending_approval`, `active`, `rejected`, `more_info_needed`
   - Capacity management, services, pricing, location

3. **[drivers.md](./drivers.md)** - Independent driver profiles
   - Real-time location tracking, availability, performance metrics
   - Vehicle information, license, ratings

### Order & Delivery Tables

4. **[orders.md](./orders.md)** - Customer orders and order items
   - Full order status machine (15 statuses)
   - Order items (service types, quantities, pricing)
   - Geographic coordinates for pickup/delivery

5. **[deliveries.md](./deliveries.md)** - Delivery tracking and dispatch
   - Pickup and delivery legs
   - Proof-of-delivery (photos, OTPs, signatures)
   - Delivery requests for first-accept-wins dispatch

### Payment & Financial Tables

6. **[payments.md](./payments.md)** - Payments and payouts
   - Customer payments, escrow management
   - Commission calculations, refunds
   - Batch payouts to laundries and drivers

### Supporting Tables

7. **[notifications.md](./notifications.md)** - Notifications and templates
   - In-app notifications, push/email/SMS tracking
   - Reusable notification templates

8. **[capacity.md](./capacity.md)** - Daily capacity logs
   - Capacity usage tracking per laundry per day
   - Capacity deductions and resets

9. **[order_status_history.md](./order_status_history.md)** - Order status audit trail
   - Complete history of status transitions
   - Who performed changes and when

10. **[delivery_issues.md](./delivery_issues.md)** - Delivery issue reporting
    - Issues reported by any party (customer, laundry, driver)
    - Severity levels, resolution workflow

### Admin Tables

11. **[admin.md](./admin.md)** - Admin audit logs and invites
    - Complete audit trail of admin actions
    - Admin user invitation system

12. **[edge_function_logs.md](./edge_function_logs.md)** - Edge Function observability
    - Execution logs, errors, performance metrics
    - Distributed tracing support

## Usage

Each markdown file contains:

1. **Prompt** - Instructions for creating the table
2. **Requirements** - Table purpose and constraints
3. **Columns** - Complete column definitions with types and constraints
4. **Business Rules** - Domain-specific validation rules
5. **RLS Policies** - Row Level Security policies for data access
6. **Indexes** - Performance optimization indexes
7. **Triggers** - Database triggers for automation
8. **Migration SQL** - Complete SQL migration script
9. **Notes** - Additional implementation notes

## Implementation Order

Recommended order for creating tables:

1. `profiles` - Base user table
2. `laundries` - Requires profiles
3. `drivers` - Requires profiles
4. `orders` - Requires profiles and laundries
5. `order_items` - Requires orders
6. `deliveries` - Requires orders and drivers
7. `delivery_requests` - Requires deliveries
8. `payments` - Requires orders
9. `payouts` - Requires payments, laundries, drivers
10. `notifications` - Requires profiles
11. `notification_templates` - Standalone
12. `capacity_logs` - Requires laundries and orders
13. `order_status_history` - Requires orders
14. `delivery_issues` - Requires deliveries and orders
15. `admin_audit_logs` - Requires profiles
16. `admin_invites` - Requires profiles
17. `edge_function_logs` - Standalone

## Key Business Rules

- **Status Machines**: Orders and deliveries follow strict status transition rules enforced via Edge Functions
- **RLS**: All tables have Row Level Security enabled with role-based access policies
- **Audit Trail**: All critical actions are logged (admin actions, status changes)
- **Geographic Queries**: Location-based tables use PostGIS or Haversine for distance calculations
- **Capacity Management**: Daily capacity tracking with automatic resets
- **Payment Escrow**: Funds held until order completion, then released minus commission

## Related Documentation

- Business Logic: `/docs/business-logic/`
- Edge Functions: `/docs/prompts/functions/`
- App Specifications: `/docs/prompts/`
