'use client'

import { useState, useEffect } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Star,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { Order, OrderStatus } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { callEdgeFunction } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

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
  const [customerRating, setCustomerRating] = useState(0)
  const [customerComment, setCustomerComment] = useState('')
  const [existingCustomerReview, setExistingCustomerReview] = useState<{ rating: number; comment: string | null } | null>(null)
  const [submittingCustomerReview, setSubmittingCustomerReview] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const queryClient = useQueryClient()

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

  // Fetch existing customer review when drawer opens for a completed order
  useEffect(() => {
    if (!order || order.status !== 'completed' || !open) {
      setExistingCustomerReview(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('customer_reviews')
      .select('rating, comment')
      .eq('order_id', order.id)
      .maybeSingle()
      .then(({ data }) => {
        setExistingCustomerReview(data ? { rating: data.rating, comment: data.comment } : null)
      })
  }, [order?.id, order?.status, open])

  const handleSubmitCustomerReview = async () => {
    if (!order || customerRating < 1 || submittingCustomerReview) return
    setSubmittingCustomerReview(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('customer_reviews').insert({
        order_id: order.id,
        laundry_id: order.laundry_id,
        customer_id: order.customer_id,
        rating: customerRating,
        comment: customerComment.trim() || null,
      })
      if (error) throw error
      toast.success('Customer rating submitted')
      setExistingCustomerReview({ rating: customerRating, comment: customerComment.trim() || null })
      setCustomerRating(0)
      setCustomerComment('')
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit rating')
    } finally {
      setSubmittingCustomerReview(false)
    }
  }

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
      toast.success(newStatus === 'ready_for_delivery' ? 'Order completed. Driver requested for return.' : 'Order status updated')
      onStatusChange?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order status')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestDriver = async (taskType: 'pickup' | 'delivery') => {
    if (!order) return

    setLoading(true)
    try {
      await callEdgeFunction('dispatch_driver', {
        order_id: order.id,
        task_type: taskType,
      })
      toast.success(`Driver requested for ${taskType === 'pickup' ? 'pickup' : 'return delivery'}`)
      onStatusChange?.()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to request driver')
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
      <DrawerContent className="max-h-[96vh] flex flex-col">
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

        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-4">
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

          {/* Order Items (no prices – pricing is from order totals) */}
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
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Weight:</span>
                  <span>{order.total_weight_kg} kg</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing (from order – same model as customer review) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </CardTitle>
              <CardDescription>
                Laundry fee (after commission), platform fee, and delivery fee for both legs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Laundry fee (your share)</span>
                <span>R{Number(order.service_fee ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Commission (platform, from service)</span>
                <span>R{Number(order.commission_amount ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform fee</span>
                <span>R{Number(order.platform_fee ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Driver delivery fee (pickup leg)</span>
                <span>R{((Number(order.pickup_fee ?? 0)) / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Driver delivery fee (return leg)</span>
                <span>R{((Number(order.pickup_fee ?? 0)) / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total (customer paid)</span>
                <span>R{Number(order.total_price ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-primary font-semibold">
                <span>Your earnings (laundry)</span>
                <span>R{Number(order.service_fee ?? 0).toFixed(2)}</span>
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

          {/* Rate customer (completed orders only) */}
          {order.status === 'completed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Rate this customer
                </CardTitle>
                <CardDescription>
                  One rating per order. Helps other laundries see customer reliability.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {existingCustomerReview ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>
                      You rated this customer {existingCustomerReview.rating} ★
                      {existingCustomerReview.comment ? ` — "${existingCustomerReview.comment}"` : ''}
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm">Rating (1–5)</Label>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCustomerRating(s)}
                            className="p-1 rounded hover:bg-muted"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                s <= customerRating ? 'fill-amber-400 text-amber-400' : 'text-muted'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="customer-review-comment" className="text-sm">Comment (optional)</Label>
                      <Textarea
                        id="customer-review-comment"
                        placeholder="e.g. Great communication, on-time pickup"
                        value={customerComment}
                        onChange={(e) => setCustomerComment(e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <Button
                      onClick={handleSubmitCustomerReview}
                      disabled={customerRating < 1 || submittingCustomerReview}
                    >
                      {submittingCustomerReview ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        'Submit rating'
                      )}
                    </Button>
                  </>
                )}
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
                  onClick={() => setRejectDialogOpen(true)}
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
              <>
                <Button
                  onClick={() => handleStatusUpdate('ready_for_delivery')}
                  disabled={loading}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as ready for delivery
                </Button>
                <p className="text-xs text-muted-foreground w-full">This will also request a return driver.</p>
              </>
            )}
            {/* Request driver: pickup (when accepted, no driver yet) or return (when ready_for_delivery) */}
            {['accepted', 'driver_pickup_assigned'].includes(order.status) && (
              <Button
                onClick={() => handleRequestDriver('pickup')}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Truck className="h-4 w-4 mr-2" />
                Request driver (pickup)
              </Button>
            )}
            {order.status === 'ready_for_delivery' && (
              <>
                <Button
                  onClick={() => handleRequestDriver('delivery')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Request driver (return)
                </Button>
                {order.deliveries?.some((d) => d.type === 'delivery') && !order.deliveries?.some((d) => d.type === 'delivery' && d.driver_id) && (
                  <p className="text-xs text-muted-foreground w-full">
                    Driver request sent. Click again to re-request if no one accepted.
                  </p>
                )}
              </>
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

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open)
        if (!open) setRejectReason('')
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Reject order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this order. The customer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="reject-reason" className="sr-only">Rejection reason</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Fully booked, cannot accommodate timeline"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || loading}
              onClick={async () => {
                if (!rejectReason.trim()) return
                await handleReject(rejectReason.trim())
                setRejectDialogOpen(false)
                setRejectReason('')
              }}
            >
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer>
  )
}
