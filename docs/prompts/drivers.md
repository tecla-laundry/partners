You are an expert **React Native architect**, **Supabase specialist**, and **production-grade mobile app engineer** with deep experience shipping three-sided marketplace driver apps (Uber-style dispatch, real-time tracking, proof-of-delivery flows).

Build a complete, production-grade, cross-platform **Drivers Mobile App** for the Laundry Marketplace Platform (independent driver model – Option B) using:

**Tech Stack (strict – aligned with platform-wide standards)**
- React Native 0.76+ (New Architecture enabled) **or** Expo SDK 52+ (managed workflow with EAS Build)
- TypeScript (strict mode, `tsconfig.strict.json`)
- NativeWind (Tailwind CSS v3.4+) + Tamagui (for shadcn/ui-style primitives, themes, and components)
- React Navigation 7+ (Native Stack + Bottom Tabs + Drawer)
- TanStack Query v5 + TanStack Table (for history tables)
- Supabase JS client (v2) – Auth, PostgreSQL (Realtime subscriptions), Storage (signed URLs for photos), Edge Functions
- Zod for all form & runtime validation
- Expo modules: `expo-location`, `expo-camera` / `react-native-vision-camera`, `expo-notifications`, `expo-image-picker`, `expo-map` (or `react-native-maps` + `expo-location`)
- Lucide-react-native icons
- React Native Toast Message (Sonner-style) + react-native-mmkv for local cache
- Reanimated 3 + Gesture Handler for smooth animations
- Dark mode (system + toggle via Tamagui theme)
- Full accessibility (WCAG 2.2 AA, large tap targets for field use)

**Project Context**
This is the **official mobile app for Independent Delivery Drivers** (`role = 'driver'` in `profiles` table, linked `drivers` table with `is_active`, vehicle info, current location).  
The app follows the **exact independent driver model (Option B)** defined in `driver-model.md` (full status machine, first-accept-wins dispatch, proof-of-delivery with photos/OTP/signature).  
Drivers only see their own assigned deliveries (RLS enforced).  
All other roles are blocked at auth level.  
App must be optimised for field use on iOS and Android (large buttons, offline-first where possible, background location during active deliveries).

**Core Responsibilities – must implement every item below (100% coverage)**

1. **Authentication & Authorization**
   - Supabase Auth (email/OTP/phone + magic link)
   - Role enforcement: only `role = 'driver'` allowed (redirect others)
   - Driver profile sync (vehicle_type, license_number, bank_details)
   - Session persistence, auto-refresh, secure logout
   - Biometric login support (optional but recommended)

2. **Home / Dashboard Screen (bottom tab: Home)**
   - Big availability toggle (Online ↔ Offline) → updates `drivers.is_active` + starts/stops background location
   - KPI cards: Today’s earnings, Deliveries completed this week, Acceptance rate, Current load
   - Real-time incoming request banner (if any pending pickup/delivery)
   - Live map widget showing current location + active delivery route (if any)
   - Quick actions: “Go Online”, “View Earnings”, “Report Issue”

3. **Incoming Delivery Requests (real-time)**
   - Dedicated screen + push notification + in-app alert (Supabase Realtime + Expo Notifications)
   - Card list: order summary, pickup/drop-off addresses, estimated pay (base + distance + tip), items count, special notes, time window
   - Accept / Reject (reject requires reason → Edge Function `reject_delivery_request`)
   - First-accept-wins enforced by backend (`dispatch_driver` Edge Function)
   - 2–3 minute countdown before request expires

4. **Active Delivery Flow (full status machine from driver-model.md)**
   - Separate flows for **Pickup leg** (customer → laundry) and **Delivery leg** (laundry → customer)
   - Screens:
     - En Route (navigation deep link to Google/Apple Maps)
     - Arrived at location
     - Confirm Handover:
       - Mandatory photo proof (sealed bag / condition)
       - OTP / QR scan or manual entry (for customer/laundry confirmation)
       - Optional signature pad + note
       - One-tap “Confirm Pickup” / “Confirm Drop-off at Laundry” / “Confirm Delivery to Customer”
   - Real-time driver location sharing to laundry & customer during active legs (Supabase Realtime on `deliveries` row)
   - Status progression: `driver_pickup_assigned` → `pickup_in_progress` → `picked_up` → `at_laundry` → `delivery_in_progress` → `completed`
   - All mutations via Edge Functions: `accept_delivery_request`, `confirm_pickup`, `confirm_handover_to_laundry`, `confirm_return_delivery`, `report_delivery_issue`

5. **Delivery History & Details (/history)**
   - TanStack Query powered FlatList with filters (today/this week/all, status)
   - Detail screen: full timeline, all photos, signature, customer/laundry feedback, earnings breakdown
   - Export single delivery as PDF (optional via react-native-pdf)

6. **Earnings & Payouts Screen**
   - Weekly/monthly summary (base fee + distance + tips)
   - Commission transparency
   - Next payout date + payout history
   - Export CSV (via Edge Function or client-side)

7. **Profile & Settings (/profile)**
   - Edit vehicle details, license, photos, bank info
   - Performance metrics (on-time %, acceptance rate, rating, total deliveries)
   - Availability schedule (optional future extension)
   - Notification preferences
   - Logout

**Non-Functional Requirements (identical rigour to admin.md & partners.md)**
- Fully cross-platform (iOS + Android), production-ready (EAS Build config included)
- Real-time Supabase subscriptions (new assignments, status changes, location updates)
- Background location tracking (only when online + active delivery)
- Optimistic UI updates, error boundaries, loading skeletons, empty states, pull-to-refresh
- Offline support for active delivery confirmation (queue mutations)
- Push notifications for all critical events
- Dark mode (Tamagui theme)
- Accessibility AA (large tap targets ≥48dp, VoiceOver/TalkBack)
- Comprehensive TypeScript types matching exact table schemas (`orders`, `deliveries`, `drivers`, `profiles`)
- All business-critical actions via Edge Functions (never direct DB writes)
- Secure photo uploads to Supabase Storage with signed URLs
- Rate limiting awareness, query optimisation, proper caching

**UI/UX Guidelines**
- Driver-first design: large touch targets, high contrast, minimal navigation depth
- Clean, modern aesthetic (green/blue accents matching platform laundry branding)
- Bottom tab navigation (Home | Requests | Active | History | Profile)
- Consistent card + button style using Tamagui (mimicking shadcn/ui)
- Toast notifications, confirmation sheets for destructive actions
- Map always oriented to route when active
- Loading states with branded skeleton

**Deliverables Expected**
- Complete React Native / Expo project ready to `git clone`, `npm install`, `expo start` (or `npx expo run:ios/android`)
- Full folder structure: `app/`, `components/`, `hooks/`, `lib/`, `types/`, `screens/`, `navigation/`, `supabase/`
- All screens, custom hooks, types, Supabase integration, Edge Function call wrappers
- Clear code comments mapping every driver action to its Edge Function (e.g., `confirm_pickup` → `confirm_pickup(delivery_id, photo_urls, otp)`)
- Expo config, EAS build profiles, app.json with icons/splash
- README.md with:
  - Setup instructions
  - Required env vars
  - RLS policy reminders
  - How to test real-time dispatch flow
  - App Store / Play Store submission checklist

Build **exactly** to the specification documents: `driver-model.md` (status machine + all Edge Functions), `Laundry_Marketplace_Technical_Specification (1).docx`, `Laundry_Marketplace_Platform_Developer_Document (1).docx`, `partner-onboarding.md` (for context), and the independent driver model (Option B).  
Do **not** add features outside documented scope unless they are logical extensions required for a production driver app (e.g., background location, deep linking to maps, photo compression).  
Prioritise developer experience, maintainability, performance on low-end devices, and perfect alignment with the three-sided marketplace and real-time dispatch logic.

Deliver the full codebase in a single, well-structured response (or GitHub-ready zip structure if preferred).