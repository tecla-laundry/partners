'use client'

import { useState, useEffect } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MapPin,
  Clock,
  DollarSign,
  Package,
  User,
  Truck,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { Order, OrderStatus } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { callEdgeFunction } from '@/lib/supabase'

interface OrderDetailDrawerProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: () => void
}

export function OrderDetailDrawer({
  order,
  open,
  onOpenChange,
  onStatusChange,
}: OrderDetailDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [realtimeDelivery, setRealtimeDelivery] = useState<any>(null)

  useEffect(() => {
    if (!order || !open) return

    const supabase = createClient()

    // Subscribe to delivery updates for real-time driver ETA
    const deliveryChannel = supabase
      .channel(`delivery-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          setRealtimeDelivery(payload.new)
        }
      )
      .subscribe()

    // Fetch current delivery data
    supabase
      .from('deliveries')
      .select('*, driver:drivers(id, profile:profiles(full_name, email, phone))')
      .eq('order_id', order.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRealtimeDelivery(data[0])
        }
      })

    return () => {
      supabase.removeChannel(deliveryChannel)
    }
  }, [order, open])

  const handleAccept = async () => {
    if (!order) return

    setLoading(true)
    try {
      await callEdgeFunction('accept_order', { order_id: order.id })
      toast.success('Order accepted successfully')
      onStatusChange?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept order')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!order) return

    setLoading(true)
    try {
      await callEdgeFunction('reject_order', {
        order_id: order.id,
        reason,
      })
      toast.success('Order rejected')
      onStatusChange?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject order')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: 'washing_in_progress' | 'ready_for_delivery') => {
    if (!order) return

    setLoading(true)
    try {
      await callEdgeFunction('update_order_status', {
        order_id: order.id,
        new_status: newStatus,
      })
      toast.success(`Order status updated to ${newStatus.replace(/_/g, ' ')}`)
      onStatusChange?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order status')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmHandover = async (
    deliveryId: string,
    handoverType: 'pickup' | 'delivery',
    photoUrl?: string
  ) => {
    if (!order) return

    setLoading(true)
    try {
      await callEdgeFunction('confirm_driver_handover', {
        order_id: order.id,
        delivery_id: deliveryId,
        handover_type: handoverType,
        photo_url: photoUrl,
      })
      toast.success('Driver handover confirmed')
      onStatusChange?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm handover')
    } finally {
      setLoading(false)
    }
  }

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

  if (!order) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-between">
            <span>Order #{order.id.slice(0, 8)}</span>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {order.status.replace(/_/g, ' ')}
            </Badge>
          </DrawerTitle>
          <DrawerDescription>
            Created {format(new Date(order.created_at), 'PPp')}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium">
                  {order.customer?.full_name || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">{order.customer?.email}</p>
                {order.customer?.phone && (
                  <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.order_items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start p-2 rounded border"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {item.service_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity} kg
                      </p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <p className="font-medium">R{item.total_price.toFixed(2)}</p>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Weight:</span>
                  <span>{order.total_weight_kg} kg</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Price:</span>
                  <span>R{order.total_price.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Pickup Address</p>
                <p className="text-sm text-muted-foreground">{order.pickup_address}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled: {format(new Date(order.scheduled_pickup_time), 'PPp')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Delivery Address</p>
                <p className="text-sm text-muted-foreground">{order.dropoff_address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Special Notes */}
          {order.special_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Special Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.special_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Driver Info & ETA */}
          {realtimeDelivery && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Driver Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {realtimeDelivery.driver && (
                  <div>
                    <p className="text-sm font-medium">
                      {realtimeDelivery.driver.profile?.full_name || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {realtimeDelivery.driver.profile?.email}
                    </p>
                  </div>
                )}
                {realtimeDelivery.estimated_arrival_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>
                      ETA: {format(new Date(realtimeDelivery.estimated_arrival_time), 'PPp')}
                    </span>
                  </div>
                )}
                {realtimeDelivery.handover_photo_url && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Handover Photo</p>
                    <img
                      src={realtimeDelivery.handover_photo_url}
                      alt="Handover"
                      className="w-full max-w-xs rounded border"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          {order.order_status_history && order.order_status_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.order_status_history
                    .sort(
                      (a, b) =>
                        new Date(b.performed_at).getTime() -
                        new Date(a.performed_at).getTime()
                    )
                    .map((history, idx) => (
                      <div key={history.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {idx < order.order_status_history!.length - 1 && (
                            <div className="w-px h-8 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-sm font-medium capitalize">
                            {history.to_status.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(history.performed_at), 'PPp')}
                          </p>
                          {history.performed_by_role && (
                            <p className="text-xs text-muted-foreground">
                              by {history.performed_by_role.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 flex-wrap">
            {order.status === 'laundry_requested' && (
              <>
                <Button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Order
                </Button>
                <Button
                  onClick={() => {
                    const reason = prompt('Please provide a reason for rejection:')
                    if (reason) {
                      handleReject(reason)
                    }
                  }}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Order
                </Button>
              </>
            )}
            {order.status === 'picked_up' && order.deliveries && (
              <>
                {order.deliveries
                  .filter((d) => d.type === 'pickup' && d.status !== 'completed')
                  .map((delivery) => (
                    <Button
                      key={delivery.id}
                      onClick={() => handleConfirmHandover(delivery.id, 'pickup')}
                      disabled={loading}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm Driver Drop-off
                    </Button>
                  ))}
              </>
            )}
            {order.status === 'at_laundry' && (
              <Button
                onClick={() => handleStatusUpdate('washing_in_progress')}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Start Washing
              </Button>
            )}
            {order.status === 'washing_in_progress' && (
              <Button
                onClick={() => handleStatusUpdate('ready_for_delivery')}
                disabled={loading}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Ready for Delivery
              </Button>
            )}
            {order.status === 'ready_for_delivery' && order.deliveries && (
              <>
                {order.deliveries
                  .filter((d) => d.type === 'delivery' && d.status === 'pending')
                  .map((delivery) => (
                    <Button
                      key={delivery.id}
                      onClick={() => handleConfirmHandover(delivery.id, 'delivery')}
                      disabled={loading}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm Driver Pickup
                    </Button>
                  ))}
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
