'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { OrderDetailDrawer } from '@/components/orders/order-detail-drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient, callEdgeFunction } from '@/lib/supabase'
import { Order, OrderStatus } from '@/lib/types'
import { format } from 'date-fns'
import { Eye, CheckCircle2, RefreshCw, Truck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const statusTabs: Record<string, OrderStatus[]> = {
  'new-requests': ['laundry_requested'],
  accepted: ['accepted', 'driver_pickup_assigned', 'pickup_in_progress', 'picked_up'],
  'in-progress': ['at_laundry', 'washing_in_progress'],
  ready: ['ready_for_delivery', 'driver_delivery_assigned', 'delivery_in_progress'],
  completed: ['completed'],
  disputed: ['disputed'],
}

async function fetchOrders(
  supabase: ReturnType<typeof createClient>,
  statuses: OrderStatus[]
): Promise<Order[]> {
  // Get user's laundry ID
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: laundry } = await supabase
    .from('laundries')
    .select('id')
    .eq('owner_user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!laundry) {
    return []
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      customer:profiles!orders_customer_id_fkey(full_name, email, phone),
      order_items(*),
      deliveries(*, driver:drivers(id, profile:profiles!user_id(full_name, email, phone))),
      order_status_history(*)
    `
    )
    .eq('laundry_id', laundry.id)
    .in('status', statuses)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching orders:', error)
    throw error
  }

  return (data || []) as Order[]
}

export default function OrdersPage() {
  const [selectedTab, setSelectedTab] = useState('new-requests')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [requestingDriverOrderId, setRequestingDriverOrderId] = useState<string | null>(null)
  const [rejectDialogOrder, setRejectDialogOrder] = useState<Order | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const statuses = statusTabs[selectedTab] || []

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', selectedTab, statuses],
    queryFn: () => fetchOrders(supabase, statuses),
  })

  const handleAcceptOrder = async (order: Order) => {
    if (order.status !== 'laundry_requested') return
    setAcceptingOrderId(order.id)
    try {
      await callEdgeFunction('accept_order', { order_id: order.id })
      toast.success('Order accepted')
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept order')
    } finally {
      setAcceptingOrderId(null)
    }
  }

  // Real-time subscription for new orders and status changes
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          refetch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetch])

  const getStatusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'accepted':
      case 'at_laundry':
        return 'default'
      case 'washing_in_progress':
      case 'ready_for_delivery':
        return 'secondary'
      case 'completed':
        return 'default'
      case 'rejected':
      case 'cancelled':
      case 'disputed':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order)
    setDrawerOpen(true)
  }

  const handleStatusUpdate = async (order: Order, newStatus: 'washing_in_progress' | 'ready_for_delivery') => {
    setUpdatingOrderId(order.id)
    try {
      await callEdgeFunction('update_order_status', {
        order_id: order.id,
        new_status: newStatus,
      })
      toast.success(newStatus === 'ready_for_delivery' ? 'Order marked ready. Driver requested for return.' : 'Order status updated')
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleRequestDriver = async (order: Order, taskType: 'pickup' | 'delivery') => {
    setRequestingDriverOrderId(order.id)
    try {
      await callEdgeFunction('dispatch_driver', {
        order_id: order.id,
        task_type: taskType,
      })
      toast.success(`Driver requested for ${taskType === 'pickup' ? 'pickup' : 'return delivery'}`)
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to request driver')
    } finally {
      setRequestingDriverOrderId(null)
    }
  }

  const hasReturnDriverAssigned = (order: Order) =>
    order.deliveries?.some((d) => d.type === 'delivery' && d.driver_id) ?? false

  const handleRejectOrder = async () => {
    if (!rejectDialogOrder || !rejectReason.trim()) return
    setRejectingOrderId(rejectDialogOrder.id)
    try {
      await callEdgeFunction('reject_order', {
        order_id: rejectDialogOrder.id,
        reason: rejectReason.trim(),
      })
      toast.success('Order rejected')
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      setRejectDialogOrder(null)
      setRejectReason('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject order')
    } finally {
      setRejectingOrderId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage new requests, in-progress loads, and completed orders.
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="new-requests" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">New Requests</TabsTrigger>
          <TabsTrigger value="accepted" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Accepted</TabsTrigger>
          <TabsTrigger value="in-progress" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">In Progress</TabsTrigger>
          <TabsTrigger value="ready" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Ready</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Completed</TabsTrigger>
          <TabsTrigger value="disputed" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Disputed</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {isLoading ? (
            <Card className="rounded-xl">
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading orders...
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card className="rounded-xl">
              <CardContent className="py-8 text-center text-muted-foreground">
                No orders found in this category.
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl overflow-hidden">
              <CardHeader>
                <CardTitle>
                  {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                </CardTitle>
                <CardDescription>
                  {selectedTab === 'new-requests' && 'Orders awaiting your response'}
                  {selectedTab === 'accepted' && 'Orders accepted and awaiting pickup'}
                  {selectedTab === 'in-progress' && 'Orders currently being processed'}
                  {selectedTab === 'ready' && 'Orders ready for delivery'}
                  {selectedTab === 'completed' && 'Completed orders'}
                  {selectedTab === 'disputed' && 'Orders with disputes'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {order.customer?.full_name || order.customer?.email || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.customer?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{order.total_weight_kg} kg</TableCell>
                        <TableCell>R{order.total_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {order.status === 'laundry_requested' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptOrder(order)}
                                  disabled={acceptingOrderId === order.id}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  {acceptingOrderId === order.id ? 'Accepting…' : 'Accept'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectDialogOrder(order)
                                    setRejectReason('')
                                  }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {selectedTab === 'accepted' && ['accepted', 'driver_pickup_assigned'].includes(order.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestDriver(order, 'pickup')}
                                disabled={requestingDriverOrderId === order.id}
                              >
                                {requestingDriverOrderId === order.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Truck className="h-4 w-4 mr-2" />
                                )}
                                Request driver
                              </Button>
                            )}
                            {selectedTab === 'in-progress' && order.status === 'at_laundry' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(order, 'washing_in_progress')}
                                disabled={updatingOrderId === order.id}
                              >
                                {updatingOrderId === order.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Start washing
                              </Button>
                            )}
                            {selectedTab === 'in-progress' && order.status === 'washing_in_progress' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(order, 'ready_for_delivery')}
                                disabled={updatingOrderId === order.id}
                              >
                                {updatingOrderId === order.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                Mark as ready
                              </Button>
                            )}
                            {selectedTab === 'ready' && order.status === 'ready_for_delivery' && (
                              hasReturnDriverAssigned(order) ? (
                                <span className="text-sm text-muted-foreground">Driver requested</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRequestDriver(order, 'delivery')}
                                  disabled={requestingDriverOrderId === order.id}
                                >
                                  {requestingDriverOrderId === order.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Truck className="h-4 w-4 mr-2" />
                                  )}
                                  Request driver
                                </Button>
                              )
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOrderClick(order)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <OrderDetailDrawer
        order={selectedOrder}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={() => {
          refetch()
          setDrawerOpen(false)
        }}
      />

      <Dialog open={!!rejectDialogOrder} onOpenChange={(open) => {
        if (!open) {
          setRejectDialogOrder(null)
          setRejectReason('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this order. The customer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="table-reject-reason" className="sr-only">Rejection reason</Label>
            <Textarea
              id="table-reject-reason"
              placeholder="e.g. Fully booked, cannot accommodate timeline"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || !!rejectingOrderId}
              onClick={handleRejectOrder}
            >
              {rejectingOrderId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting…
                </>
              ) : (
                'Reject order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
