
You are an expert React Native architect and senior full-stack engineer with 10+ years building multi-sided marketplace apps (Uber, Airbnb, DoorDash clones) on Supabase.

Build the COMPLETE React Native Customer App for the Laundry Marketplace Platform (three-sided marketplace: Customers – Laundry Partners – Independent Drivers). Use the **independent driver model** (Option B) as defined in driver-model.md dated 17 February 2026.

### 1. Project Setup & Tech Stack (Strictly Follow)
- Expo SDK 52 (latest stable) with EAS Build
- TypeScript (strict mode)
- React Navigation 7 (Native Stack + Bottom Tabs + Modal)
- Supabase JS client v2 (@supabase/supabase-js)
- TanStack Query v5 (data fetching, caching, optimistic updates) + Zustand for global state (auth, currentOrder)
- React Native Maps + react-native-maps-directions (Google Maps, API key via .env)
- Expo Location, Expo Notifications, Expo Image Picker, Expo Camera
- Payment: Paystack React Native SDK (South Africa – ZAR, sandbox + live)
- UI: NativeWind (Tailwind) + Shadcn/ui style components (create reusable components: Button, Card, Input, MapPin, StatusBadge, etc.)
- Folder structure (standard scalable):
  ```
  src/
  ├── app/                  # Expo Router or screens/
  ├── components/           # UI primitives + feature components
  ├── features/             # feature slices (auth, orders, laundries, tracking)
  ├── hooks/
  ├── lib/                  # supabaseClient.ts, utils, constants
  ├── navigation/
  ├── store/                # Zustand stores
  ├── types/                # Supabase generated types + custom
  └── assets/
  ```
- Environment: .env for SUPABASE_URL, SUPABASE_ANON_KEY, PAYSTACK_PUBLIC_KEY, GOOGLE_MAPS_API_KEY
- Code quality: ESLint (Airbnb), Prettier, Husky, TypeScript strict

### 2. Core Business Rules (Embed ALL from Documents)
- User roles: only 'customer' for this app (profiles.role = 'customer')
- Full Order Status Machine (exact enum from driver-model.md):
  'pending' → 'laundry_requested' → 'accepted' → 'driver_pickup_assigned' → 'pickup_in_progress' → 'picked_up' → 'at_laundry' → 'washing_in_progress' → 'ready_for_delivery' → 'driver_delivery_assigned' → 'delivery_in_progress' → 'completed' | 'cancelled' | 'disputed'
- Real-time tracking: Supabase Realtime subscriptions on `orders` and `deliveries` + drivers.current_lat/long when driver assigned
- Dispatch logic happens in backend Edge Functions – customer app only triggers `create_order` and listens
- Customer pays full amount at order confirmation (escrow via Paystack)
- Mandatory proof-of-delivery visibility: show pickup_photo_url and delivery_photo_url when available
- Location: Johannesburg focus (Randburg, Bryanston, Sandton) but app must work anywhere with coverage check via Edge Function

### 3. Screens & Navigation (Exact List)
Bottom Tab Navigator:
1. Home (Browse + Quick Order)
2. My Orders (list + active order card)
3. Track (live map when order active)
4. History
5. Profile

Full Screen Flow:
- Auth Stack: Onboarding → Login/Signup (Supabase Auth + magic link/OTP) → Role selection (default customer)
- Home:
  - Hero with "Get your laundry done in 24h"
  - Current location + address selector
  - "New Order" floating button → multi-step order creation
  - Nearby laundries carousel (active only, sorted by distance + rating)
- Order Creation (multi-step wizard – use @gorhom/bottom-sheet or modal stack):
  Step 1: Service selection (wash & fold, dry cleaning, iron only, etc.) + kg estimate or item count
  Step 2: Pickup address (current GPS or search) + preferred time slot (today/tomorrow slots)
  Step 3: Available laundries (map + list, show price/kg, capacity, rating, ETA)
  Step 4: Review & Pay (total breakdown: service + delivery fee + platform fee)
- Order Tracking (live):
  - Vertical timeline with all statuses + timestamps
  - Live map showing driver location (when in pickup_in_progress or delivery_in_progress)
  - Driver card (photo if available, name, vehicle, ETA, call button)
  - "Confirm Receipt" button on return delivery (photo + signature/OTP)
- My Orders & History: cards with status badge (use color-coded: pending=orange, in-progress=blue, completed=green)
- Profile: edit details, order history summary, payment methods, addresses, ratings given, logout

### 4. Supabase Integration (Critical)
- Generate types: supabase gen types typescript > src/types/supabase.ts
- RLS respected (customer can only see own orders, active laundries)
- Key Edge Functions to call from app (use supabase.functions.invoke):
  - create_order (payload: customer_id, laundry_id, services, weight, pickup_address, scheduled_time)
  - cancel_order (with reason)
  - confirm_return_delivery (photo + otp)
- Realtime subscriptions:
  - orders table (own rows)
  - deliveries table (linked to own orders)
  - drivers table (only when driver assigned – subscribe to location)
- Storage: upload proof photos if customer ever needs to (damage report)

### 5. Key Flows to Implement Exactly
1. Order Creation → Paystack checkout → onSuccess → call create_order Edge Function → status becomes 'laundry_requested'
2. Real-time status updates push to all relevant screens
3. When status = 'driver_pickup_assigned' or 'driver_delivery_assigned': show driver card + live map + ETA
4. On 'completed': trigger rating modal for laundry + driver
5. Push notifications (Expo) for every status change + driver assigned
6. Location coverage validation on order creation

### 6. Non-Functional Requirements
- Offline-first where possible (TanStack Query cache)
- Performance: lazy load maps, memoize heavy components
- Accessibility: labels, contrast, screen reader friendly
- Dark mode support
- i18n ready (English primary, prepare for Zulu/Afrikaans)
- Analytics ready (placeholder for PostHog or Mixpanel)
- Error handling & loading states everywhere (use skeletons)
- Security: never expose service_role key, all calls via anon + RLS

### 7. Deliverables You Must Output
Generate the FULL codebase in one response (or clear file-by-file structure with complete code for each file). Include:
- app.json / app.config.js
- All screen components
- Custom hooks (useOrder, useLiveTracking, useNearbyLaundries)
- Zustand stores
- Supabase client wrapper with auth listener
- Paystack integration example
- Tailwind config + theme (primary color: emerald-600 for "fresh & clean")
- README with EAS build commands and Supabase RLS policies reminder

Start building now. Begin with project initialization commands, then folder structure, then supabase client, auth flow, and proceed feature by feature. Ask for clarification only if something is missing from the spec above. This must be production-grade, clean, well-commented, and ready for EAS Submit to App Store & Play Store.

Begin.
