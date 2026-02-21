'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfDay, endOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'
import {
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Package,
  Wallet,
  Gauge,
} from 'lucide-react'
import { HeroOverview } from '@/components/dashboard/hero-overview'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ActivityFeed, type ActivityItem } from '@/components/dashboard/activity-feed'

async function fetchLaundryId(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('laundries')
    .select('id')
    .eq('owner_user_id', user.id)
    .single()
  if (error) throw error
  return data.id
}

async function fetchOverviewData(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  laundryId: string
) {
  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())

  const [
    { data: orders },
    { data: todayPayments },
    { data: capacityLogs },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('laundry_id', laundryId),
    supabase
      .from('payments')
      .select('laundry_payout_amount, created_at, orders!inner(completed_at, laundry_id)')
      .eq('orders.laundry_id', laundryId)
      .eq('status', 'completed')
      .eq('escrow_status', 'released')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString()),
    supabase
      .from('capacity_logs')
      .select('total_capacity_kg, used_capacity_kg, date')
      .eq('laundry_id', laundryId)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .eq('action', 'reset')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('orders')
      .select('id, status, created_at, customer:profiles!orders_customer_id_fkey(full_name)')
      .eq('laundry_id', laundryId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const pending = (orders || []).filter(
    (o) => o.status === 'laundry_requested'
  ).length
  const acceptedToday = (orders || []).filter(
    (o) =>
      ['accepted', 'driver_pickup_assigned', 'pickup_in_progress', 'picked_up'].includes(o.status) &&
      new Date(o.created_at) >= todayStart
  ).length
  const inWashing = (orders || []).filter((o) =>
    ['at_laundry', 'washing_in_progress'].includes(o.status)
  ).length
  const readyForDelivery = (orders || []).filter((o) =>
    ['ready_for_delivery', 'driver_delivery_assigned', 'delivery_in_progress'].includes(o.status)
  ).length

  let todayEarnings = 0
  if (todayPayments) {
    todayPayments.forEach((p: { laundry_payout_amount?: number }) => {
      todayEarnings += Number(p.laundry_payout_amount || 0)
    })
  }

  const cap = capacityLogs?.[0]
  const totalCap = cap?.total_capacity_kg || 0
  const usedCap = cap?.used_capacity_kg || 0
  const capacityPct = totalCap > 0 ? Math.round((usedCap / totalCap) * 100) : 0

  const activityItems: ActivityItem[] = (recentOrders || []).map((o: any) => ({
    id: o.id,
    type: 'order',
    title: `Order ${o.id.slice(0, 8)} • ${o.status.replace(/_/g, ' ')}`,
    time: format(new Date(o.created_at), 'MMM d, HH:mm'),
    avatarUrl: null,
  }))

  return {
    pending,
    acceptedToday,
    inWashing,
    readyForDelivery,
    todayEarnings,
    capacityPct,
    activityItems,
  }
}

export default function DashboardPage() {
  const supabase = createClient()

  const { data: laundryId, isLoading: loadingId } = useQuery({
    queryKey: ['laundry-id'],
    queryFn: () => fetchLaundryId(supabase),
  })

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard-overview', laundryId],
    queryFn: () => fetchOverviewData(supabase, laundryId!),
    enabled: !!laundryId,
  })

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const todayEarningsStr =
    overview != null
      ? `R${overview.todayEarnings.toFixed(2)}`
      : 'R0.00'

  const loading = loadingId || loadingOverview

  return (
    <div className="space-y-6">
      {/* Hero with welcome + today's earnings */}
      <HeroOverview
        greeting={greeting}
        todayEarnings={todayEarningsStr}
        loading={loading}
      />

      {/* 2×3 KPI grid on desktop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          label="Pending Orders"
          value={overview?.pending ?? 0}
          numericValue={overview?.pending ?? 0}
          sublabel="Awaiting response"
          icon={<ShoppingBag className="h-4 w-4" />}
          accent="sage"
          loading={loading}
        />
        <KpiCard
          label="Accepted Today"
          value={overview?.acceptedToday ?? 0}
          numericValue={overview?.acceptedToday ?? 0}
          sublabel="New acceptances"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="muted"
          loading={loading}
        />
        <KpiCard
          label="In Washing"
          value={overview?.inWashing ?? 0}
          numericValue={overview?.inWashing ?? 0}
          sublabel="At laundry / in progress"
          icon={<Loader2 className="h-4 w-4" />}
          accent="muted"
          loading={loading}
        />
        <KpiCard
          label="Ready for Delivery"
          value={overview?.readyForDelivery ?? 0}
          numericValue={overview?.readyForDelivery ?? 0}
          sublabel="Out for delivery"
          icon={<Package className="h-4 w-4" />}
          accent="sky"
          loading={loading}
        />
        <KpiCard
          label="Earnings Today"
          value={todayEarningsStr}
          numericValue={overview?.todayEarnings ?? 0}
          sublabel="Net after commission"
          icon={<Wallet className="h-4 w-4" />}
          accent="sage"
          loading={loading}
        />
        <KpiCard
          label="Capacity Used"
          value={`${overview?.capacityPct ?? 0}%`}
          numericValue={overview?.capacityPct ?? 0}
          sublabel="Today"
          icon={<Gauge className="h-4 w-4" />}
          accent="muted"
          loading={loading}
        />
      </motion.div>

      {/* Main content + activity feed: two columns on large screens */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
      >
        <div className="rounded-xl border bg-card p-6 shadow-card min-h-[200px]">
          <h2 className="text-lg font-semibold mb-2">Live view</h2>
          <p className="text-sm text-muted-foreground">
            Your orders, capacity, and earnings at a glance. Use the sidebar to
            open Orders, Capacity, or Earnings for details.
          </p>
        </div>
        <ActivityFeed
          items={overview?.activityItems ?? []}
          loading={loading}
        />
      </motion.div>
    </div>
  )
}
