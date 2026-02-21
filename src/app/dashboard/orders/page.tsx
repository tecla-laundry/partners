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
import { createClient, callEdgeFunction } from '@/lib/supabase'
import { Order, OrderStatus } from '@/lib/types'
import { format } from 'date-fns'
import { Eye, CheckCircle2 } from 'lucide-react'
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
      customer:profiles!customer_id(full_name, email, phone),
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
  const supabase = createClient()
  const queryClient = useQueryClient()

  const statuses = statusTabs[selectedTab] || []

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', selectedTab, statuses],
    queryFn: () => fetchOrders(supabase, statuses),
  })

  console.log("ORDERS", orders)

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
                        <TableCell>${order.total_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {order.status === 'laundry_requested' && (
                              <Button
                                size="sm"
                                onClick={() => handleAcceptOrder(order)}
                                disabled={acceptingOrderId === order.id}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {acceptingOrderId === order.id ? 'Accepting…' : 'Accept'}
                              </Button>
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
    </div>
  )
}
