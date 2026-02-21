
You are an expert Next.js architect, Supabase specialist, and enterprise dashboard engineer. Build a complete, production-grade, responsive Admin Dashboard for the Laundry Marketplace Platform using:

**Tech Stack (strict)**
- Next.js 15 (App Router, React 19, Server Actions, Server Components)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui + Radix primitives + Lucide icons
- TanStack Query v5 + TanStack Table v8 (for all data tables)
- Recharts or Tremor for analytics charts
- Supabase JS client (v2) for Auth, PostgreSQL, Storage, Realtime, Edge Functions
- Zod for all form validation
- Next.js middleware for route protection
- Optional: Leaflet or @vis.gl/react-google-maps for live driver/location views
- Deployment-ready structure (app/, components/, lib/, hooks/, types/)

**Project Context & Scope**
This is the **Admin Dashboard** (responsive web app) for a three-sided marketplace (Customers – Laundry Partners – Independent Drivers) built 100% on Supabase. The platform uses the **full independent driver model** (Option B) with the exact Order Status Machine and dispatch logic defined in driver-model.md.

Admin users (role = 'admin' in profiles table) are the only ones who can access this dashboard. All other roles are blocked at middleware level.

**Core Responsibilities of the Admin Dashboard (must cover every point below)**

1. **Authentication & Authorization**
   - Supabase Auth + RLS enforced
   - Middleware redirects non-admin users to /sign-in or 403 page
   - Role check on every protected layout/page (server-side)
   - Session refresh handling + logout

2. **Overview Dashboard (/admin)**
   - KPI cards: Total Orders (today/this week), Gross Revenue, Platform Commission, Active Laundries, Active Drivers, Pending Approvals, Open Disputes
   - Charts: Orders by status (last 30 days), Revenue trend, Top 5 laundries by volume, Driver acceptance rate
   - Real-time widgets: Live map showing active drivers (current_lat/long) and in-progress deliveries
   - Recent activity feed (last 10 status changes, disputes, approvals)

3. **Laundry Partner Management (/admin/laundries)**
   - Full CRUD + approval workflow as defined in partner-onboarding.md
   - Tabs: Pending Approval | Active | Rejected | More Info Needed
   - Advanced filters: location (within Johannesburg area), capacity, rating, services_offered
   - Bulk approve/reject
   - Detail view modal with all uploaded photos (Storage signed URLs), Google Maps pin, operating hours, bank details (masked)
   - One-click Approve / Reject (with mandatory reason) → calls Edge Functions `approve_laundry_partner` / `reject_laundry_partner`
   - Edit profile (critical fields trigger re-approval flag)

4. **Driver Management (/admin/drivers)**
   - List all drivers with filters (active/inactive, rating, acceptance rate, current load)
   - Approve / Suspend / Deactivate (toggle is_active)
   - View live location on map (when active)
   - Performance metrics per driver (on-time %, acceptance rate, earnings)
   - Detail view: license, vehicle, completed deliveries, issues reported

5. **Order & Delivery Management (/admin/orders)**
   - Unified table of all orders with full status machine (pending → completed)
   - Filters: status, date range, customer, laundry, driver, amount
   - Detail drawer: full timeline, all photos (pickup/dropoff), OTPs, signatures, driver live tracking link
   - Manual intervention: force status change (with audit log), re-dispatch driver (calls `dispatch_driver` Edge Function)
   - Export to CSV

6. **Dispute & Issue Management (/admin/disputes)**
   - List all orders where status = 'disputed' or issues reported by any party
   - Evidence viewer (photos, notes, signatures)
   - Resolve / Refund / Escalate actions (with reason)
   - Notification to all parties via Edge Function

7. **Finance & Commissions (/admin/finance)**
   - Commission management: global rate (default 15%) + per-laundry overrides
   - Payout overview: pending laundry payouts, driver payouts, escrow balance
   - One-click “Process Weekly Payouts” button → calls `process_payouts` Edge Function
   - Detailed earnings reports (laundry vs driver vs platform)
   - Payment table with webhook status

8. **Analytics & Reports (/admin/analytics)**
   - Deep dive dashboards (use Recharts)
   - Geographic heat map of orders (Randburg, Bryanston, Sandton focus)
   - Cohort analysis, retention, peak hours
   - Exportable reports (PDF/CSV)

9. **Admin Management (/admin/admins)**
   - Invite new admin (calls `invite_admin` Edge Function)
   - List active admins + revoke access

10. **Platform Settings (/admin/settings)**
    - Coverage areas, default radius, dispatch timeouts, notification templates
    - Global feature flags (e.g., driver model enabled)

**Non-Functional Requirements**
- Fully responsive (mobile-first, works on tablet for field admins)
- Real-time updates via Supabase Realtime subscriptions on orders, deliveries, driver locations, and pending approvals
- Optimistic updates + proper error boundaries
- Loading skeletons + empty states
- Dark mode support (system + toggle)
- Accessibility (WCAG 2.2 AA)
- Rate limiting awareness and proper Supabase query optimisation
- All mutations must go through defined Edge Functions where they exist (never direct DB writes for business-critical actions)
- Comprehensive TypeScript types matching the exact table schemas in the documents (Users, Laundries, Drivers, Orders, Deliveries, Payments, etc.)
- Audit logging: every admin action (approve, status change, payout, etc.) logged in an `admin_audit_logs` table

**UI/UX Guidelines**
- Modern SaaS admin aesthetic (clean, professional, blue/gray palette)
- Consistent sidebar navigation with icons
- Breadcrumbs + search bar (global)
- shadcn/ui DataTable with column visibility, sorting, pagination, row actions
- Modals and drawers for all detail/edit flows
- Toast notifications (Sonner)
- Confirmation dialogs for destructive actions

**Deliverables Expected**
- Complete Next.js project structure ready to `git clone` and `npm run dev`
- All pages, components, hooks, types, and Supabase integration code
- Clear comments on how each admin action maps to Edge Functions
- README with setup instructions, environment variables, and RLS policy reminders

Build this exactly to the specification documents provided. Do not add features outside the documented scope unless they are logical extensions required for a production admin panel (e.g., audit logs, live driver map). Prioritise developer experience and maintainability.
