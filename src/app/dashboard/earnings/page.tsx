'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Download, TrendingUp, Calendar, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

type EarningRow = {
  id: string
  order_id: string
  amount: number
  description: string | null
  paid: boolean
  paid_at: string | null
  created_at: string
}

async function fetchEarnings(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  laundryId: string,
  period: 'week' | 'month'
) {
  const now = new Date()
  const startDate =
    period === 'week' ? startOfWeek(subDays(now, 7)) : startOfMonth(subDays(now, 30))
  const endDate = period === 'week' ? endOfWeek(now) : endOfMonth(now)

  const { data, error } = await supabase
    .from('earnings')
    .select('id, order_id, amount, description, paid, paid_at, created_at')
    .eq('recipient_type', 'laundry')
    .eq('recipient_id', laundryId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as EarningRow[]
}

async function fetchPayouts(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>,
  laundryId: string
) {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('recipient_type', 'laundry')
    .eq('recipient_id', laundryId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

async function fetchNextPayoutDate(
  supabase: ReturnType<typeof import('@/lib/supabase').createClient>
) {
  // Typically payouts are processed weekly, so next payout would be next week
  const nextWeek = startOfWeek(subDays(new Date(), -7))
  return format(nextWeek, 'MMMM dd, yyyy')
}

export default function EarningsPage() {
  const supabase = createClient()
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  const { data: laundryId, isLoading: loadingId } = useQuery({
    queryKey: ['laundry-id'],
    queryFn: () => fetchLaundryId(supabase),
  })

  const { data: earnings, isLoading: loadingEarnings } = useQuery({
    queryKey: ['earnings', laundryId, period],
    queryFn: () => fetchEarnings(supabase, laundryId!, period),
    enabled: !!laundryId,
  })

  const { data: payouts, isLoading: loadingPayouts } = useQuery({
    queryKey: ['payouts', laundryId],
    queryFn: () => fetchPayouts(supabase, laundryId!),
    enabled: !!laundryId,
  })

  const { data: nextPayoutDate } = useQuery({
    queryKey: ['next-payout-date'],
    queryFn: () => fetchNextPayoutDate(supabase),
  })

  const summary = useMemo(() => {
    if (!earnings) return null

    const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const unpaidTotal = earnings.filter((e) => !e.paid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const paidTotal = earnings.filter((e) => e.paid).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const orderCount = new Set(earnings.map((e) => e.order_id)).size

    return {
      totalEarnings,
      unpaidTotal,
      paidTotal,
      orderCount,
    }
  }, [earnings])

  const chartData = useMemo(() => {
    if (!earnings) return []

    const grouped: Record<string, { earnings: number }> = {}

    earnings.forEach((e) => {
      const date = format(new Date(e.created_at), 'MMM dd')
      if (!grouped[date]) grouped[date] = { earnings: 0 }
      grouped[date].earnings += Number(e.amount || 0)
    })

    return Object.entries(grouped)
      .map(([date, values]) => ({ date, earnings: values.earnings }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [earnings])

  const handleExportCSV = () => {
    if (!earnings || earnings.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = ['Date', 'Order ID', 'Amount', 'Description', 'Paid', 'Paid at']
    const rows = earnings.map((e) => [
      format(new Date(e.created_at), 'yyyy-MM-dd'),
      e.order_id?.slice(0, 8) || 'N/A',
      Number(e.amount || 0).toFixed(2),
      e.description || '',
      e.paid ? 'Yes' : 'No',
      e.paid_at ? format(new Date(e.paid_at), 'yyyy-MM-dd') : '',
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `earnings_${period}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('CSV exported successfully')
  }

  if (loadingId || loadingEarnings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Earnings & Payouts</h1>
          <p className="text-sm text-muted-foreground">
            Track your laundry earnings, commissions, and payout history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!earnings?.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{summary.totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {period === 'week' ? 'This week' : 'This month'}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{summary.unpaidTotal.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Pending payout</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R{summary.paidTotal.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Already paid out</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.orderCount}</div>
              <p className="text-xs text-muted-foreground">Completed orders</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')}>
        <TabsList>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-4">
          {/* Charts */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Earnings trend</CardTitle>
                <CardDescription>Daily earnings (laundry share)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2} name="Earnings" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Earnings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Earnings</CardTitle>
              <CardDescription>Per-order laundry share (from earnings table)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !earnings || earnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No earnings data available for this period
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Paid at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {format(new Date(e.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {e.order_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          R{Number(e.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{e.description ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={e.paid ? 'default' : 'secondary'}>
                            {e.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.paid_at ? format(new Date(e.paid_at), 'MMM dd, yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            {nextPayoutDate && (
              <span>Next payout date: {nextPayoutDate}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPayouts ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payout history available
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      {format(new Date(payout.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {payout.period_start && payout.period_end
                        ? `${format(new Date(payout.period_start), 'MMM dd')} - ${format(new Date(payout.period_end), 'MMM dd')}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">
                      R{Number(payout.amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payout.status === 'completed'
                            ? 'default'
                            : payout.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payout.payout_provider_transaction_id || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
