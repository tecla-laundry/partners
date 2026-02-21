'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { CapacityLog, Laundry } from '@/lib/types'
import { format, startOfDay, addDays, eachDayOfInterval, isToday } from 'date-fns'
import { AlertCircle, Calendar, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

async function fetchLaundry(supabase: ReturnType<typeof createClient>): Promise<Laundry | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('laundries')
    .select('*')
    .eq('owner_user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error) {
    console.error('Error fetching laundry:', error)
    return null
  }

  return data as Laundry
}

async function fetchCapacityLogs(
  supabase: ReturnType<typeof createClient>,
  laundryId: string,
  startDate: Date,
  endDate: Date
): Promise<CapacityLog[]> {
  const { data, error } = await supabase
    .from('capacity_logs')
    .select('*')
    .eq('laundry_id', laundryId)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching capacity logs:', error)
    throw error
  }

  return (data || []) as CapacityLog[]
}

async function setDailyCapacity(
  supabase: ReturnType<typeof createClient>,
  laundryId: string,
  date: string,
  capacityKg: number
) {
  // Get current capacity for the day
  const { data: existing } = await supabase
    .from('capacity_logs')
    .select('*')
    .eq('laundry_id', laundryId)
    .eq('date', date)
    .eq('action', 'reset')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const usedCapacity = existing?.used_capacity_kg || 0
  const remainingCapacity = capacityKg - usedCapacity

  if (remainingCapacity < 0) {
    throw new Error('Cannot set capacity below current usage')
  }

  const { error } = await supabase.from('capacity_logs').insert({
    laundry_id: laundryId,
    date,
    total_capacity_kg: capacityKg,
    used_capacity_kg: usedCapacity,
    remaining_capacity_kg: remainingCapacity,
    action: 'reset',
    amount_kg: capacityKg,
    notes: `Daily capacity set to ${capacityKg}kg`,
  })

  if (error) throw error
}

export default function CapacityPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [capacityInput, setCapacityInput] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: laundry } = useQuery({
    queryKey: ['laundry'],
    queryFn: () => fetchLaundry(supabase),
  })

  const startDate = startOfDay(addDays(new Date(), -7))
  const endDate = addDays(new Date(), 30)

  const { data: capacityLogs = [] } = useQuery({
    queryKey: ['capacity-logs', laundry?.id, startDate, endDate],
    queryFn: () => fetchCapacityLogs(supabase, laundry!.id, startDate, endDate),
    enabled: !!laundry,
  })

  // Get today's capacity
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayCapacity = capacityLogs
    .filter((log) => log.date === today && log.action === 'reset')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const currentUsed = todayCapacity?.used_capacity_kg || 0
  const currentTotal = todayCapacity?.total_capacity_kg || laundry?.capacity_per_day || 0
  const currentRemaining = currentTotal - currentUsed
  const usagePercent = currentTotal > 0 ? (currentUsed / currentTotal) * 100 : 0

  // Get capacity for each day in the next 30 days
  const days = eachDayOfInterval({ start: new Date(), end: endDate })
  const dayCapacities = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayLog = capacityLogs
      .filter((log) => log.date === dayStr && log.action === 'reset')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    return {
      date: day,
      dateStr: dayStr,
      total: dayLog?.total_capacity_kg || laundry?.capacity_per_day || 0,
      used: dayLog?.used_capacity_kg || 0,
      remaining: (dayLog?.total_capacity_kg || laundry?.capacity_per_day || 0) - (dayLog?.used_capacity_kg || 0),
    }
  })

  const setCapacityMutation = useMutation({
    mutationFn: async ({ date, capacity }: { date: string; capacity: number }) => {
      if (!laundry) throw new Error('No laundry found')
      await setDailyCapacity(supabase, laundry.id, date, capacity)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capacity-logs'] })
      toast.success('Capacity updated successfully')
      setCapacityInput('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update capacity')
    },
  })

  const handleSetCapacity = () => {
    const capacity = parseInt(capacityInput)
    if (isNaN(capacity) || capacity <= 0) {
      toast.error('Please enter a valid capacity')
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    setCapacityMutation.mutate({ date: dateStr, capacity })
  }

  // Real-time subscription for capacity changes
  useEffect(() => {
    if (!laundry) return

    const channel = supabase
      .channel('capacity-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'capacity_logs',
          filter: `laundry_id=eq.${laundry.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['capacity-logs'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, laundry, queryClient])

  if (!laundry) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capacity</h1>
          <p className="text-sm text-muted-foreground">
            Configure and monitor your daily capacity across days of the week.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active laundry found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Capacity</h1>
        <p className="text-sm text-muted-foreground">
          Configure and monitor your daily capacity across days of the week.
        </p>
      </div>

      {/* Today's Capacity Meter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Today&apos;s Capacity
          </CardTitle>
          <CardDescription>
            Real-time usage meter (deducted automatically on acceptance)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used</span>
              <span className="font-medium">
                {currentUsed} kg / {currentTotal} kg
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usagePercent >= 90
                    ? 'bg-destructive'
                    : usagePercent >= 75
                    ? 'bg-yellow-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Remaining: {currentRemaining} kg</span>
              <span>{usagePercent.toFixed(1)}% used</span>
            </div>
          </div>

          {usagePercent >= 75 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {usagePercent >= 90
                  ? 'Warning: Capacity nearly full!'
                  : 'Warning: Approaching capacity limit'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set Daily Capacity */}
      <Card>
        <CardHeader>
          <CardTitle>Set Daily Capacity</CardTitle>
          <CardDescription>
            Set the capacity for a specific day (default: {laundry.capacity_per_day} kg)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (kg)</Label>
            <Input
              id="capacity"
              type="number"
              placeholder={`Default: ${laundry.capacity_per_day} kg`}
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              min="1"
            />
          </div>
          <Button
            onClick={handleSetCapacity}
            disabled={setCapacityMutation.isPending || !capacityInput}
          >
            Set Capacity
          </Button>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar View
          </CardTitle>
          <CardDescription>Booked capacity for the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {dayCapacities.map((day) => {
              const dayUsagePercent = day.total > 0 ? (day.used / day.total) * 100 : 0
              const isTodayDate = isToday(day.date)

              return (
                <div
                  key={day.dateStr}
                  className={`p-3 rounded-lg border ${
                    isTodayDate ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">
                        {format(day.date, 'MMM d')}
                      </p>
                      {isTodayDate && (
                        <Badge variant="default" className="text-xs mt-1">
                          Today
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Used</span>
                      <span className="font-medium">
                        {day.used} / {day.total} kg
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          dayUsagePercent >= 90
                            ? 'bg-destructive'
                            : dayUsagePercent >= 75
                            ? 'bg-yellow-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(dayUsagePercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {day.remaining} kg remaining
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
