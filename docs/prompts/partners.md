You are an expert Next.js architect, Supabase specialist, and enterprise dashboard engineer.

Build a complete, production-grade, responsive **Laundry Partner Dashboard** for the Laundry Marketplace Platform using:

**Tech Stack (strict – identical to admin dashboard)**
- Next.js 15 (App Router, React 19, Server Actions, Server Components)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui + Radix primitives + Lucide icons
- TanStack Query v5 + TanStack Table v8
- Recharts or Tremor for charts
- Supabase JS client (v2) – Auth, PostgreSQL, Storage, Realtime, Edge Functions
- Zod for validation
- Next.js middleware for route protection
- Sonner for toasts, dark mode, full accessibility (WCAG 2.2 AA)
- Deployment-ready structure (app/, components/, lib/, hooks/, types/)

**Project Context**
This is the **official web dashboard for Laundry Partners (laundromats / laundry owners)** – role = 'laundry_owner' AND laundries.status = 'active'.  
All other roles are blocked at middleware level.  
Partners only see their own data (RLS enforced).  
Dashboard must work perfectly on desktop, tablet and mobile (field use).

**Core Responsibilities – must implement every item below**

1. **Authentication & Authorization**
   - Supabase Auth + RLS
   - Middleware blocks non-active-laundry_owner users
   - Server-side role + status check on every protected route
   - Session refresh + logout

2. **Overview Dashboard (/dashboard or /partner)**
   - KPI cards: Pending orders, Accepted today, In-washing, Ready for delivery, Earnings (today/week), Capacity used/available
   - Charts: Order volume (last 30 days), Revenue trend, Average processing time
   - Real-time incoming order alerts
   - Recent activity feed (last 10 status changes, disputes, payouts)

3. **Order Management (/dashboard/orders)**
   - Tabs: New Requests | Accepted | In Progress | Ready | Completed | Disputed
   - Full status machine support (driver-model.md):
     • Accept / Reject incoming orders (with reason)
     • Confirm driver drop-off (pickup leg) – photo + signature/QR
     • Update: washing_in_progress → ready_for_delivery
     • Confirm driver pickup (return leg) – photo/QR
   - Detail drawer: customer info, items, special notes, photos, driver ETA (realtime), full timeline
   - One-click status updates via Edge Functions where defined
   - Real-time subscription on new orders and status changes

4. **Capacity Management (/dashboard/capacity)**
   - Set daily capacity (kg or bags)
   - Real-time usage meter (deducted automatically on acceptance)
   - Calendar view of booked capacity
   - Warning when approaching limit

5. **Profile & Settings (/dashboard/profile)**
   - Edit business details, services, pricing, operating hours, photos, bank details
   - Critical changes (address, services) trigger re-approval flag
   - View approval status + rejection reason if any

6. **Earnings & Payouts (/dashboard/earnings)**
   - Weekly/monthly earnings breakdown (laundry fee + tips)
   - Commission deducted (visible)
   - Payout history + next payout date
   - Export CSV/PDF

7. **Ratings & Reviews (/dashboard/reviews)**
   - All customer reviews with ratings
   - Response functionality

8. **Disputes (/dashboard/disputes)**
   - List of orders with disputes/issues involving this laundry
   - View evidence (photos, notes)
   - Respond / accept resolution

**Non-Functional Requirements (identical to admin)**
- Fully responsive (mobile-first)
- Real-time Supabase subscriptions (new orders, status changes, driver location during active delivery)
- Optimistic updates, error boundaries, loading skeletons, empty states
- Dark mode (system + toggle)
- Accessibility AA
- All business-critical mutations via Edge Functions (accept_order, update_order_status, confirm_handover, etc.)
- Comprehensive TypeScript types matching exact table schemas
- Audit logging not required for partner actions (only admin)

**UI/UX Guidelines**
- Clean, professional laundry-brand aesthetic (green/blue palette optional)
- Sidebar navigation with icons
- Breadcrumbs + global search
- shadcn DataTable with sorting, pagination, row actions
- Drawers + modals for details
- Toast notifications (Sonner)
- Confirmation dialogs for destructive actions (reject order, etc.)

**Deliverables Expected**
- Complete Next.js project ready to `git clone` and `npm run dev`
- All pages, components, hooks, types, Supabase integration
- Clear comments mapping every action to its Edge Function
- README with setup, env vars, RLS reminders, and how to handle re-approval flow

Build exactly to the specification documents (partner-onboarding.md, driver-model.md, technical spec, etc.).  
Do not add features outside documented scope unless they are logical extensions for a production partner dashboard (e.g., real-time driver ETA, capacity meter).  
Prioritise developer experience, maintainability, and perfect alignment with the independent driver model (Option B).

