export type OrderStatus =
  | 'pending'
  | 'laundry_requested'
  | 'accepted'
  | 'rejected'
  | 'driver_pickup_assigned'
  | 'pickup_in_progress'
  | 'picked_up'
  | 'at_laundry'
  | 'washing_in_progress'
  | 'ready_for_delivery'
  | 'driver_delivery_assigned'
  | 'delivery_in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export interface Order {
  id: string
  customer_id: string
  laundry_id: string
  status: OrderStatus
  total_price: number
  service_fee: number
  pickup_fee: number
  commission_amount: number
  platform_fee: number
  pickup_address: string
  pickup_latitude: number
  pickup_longitude: number
  dropoff_address: string
  dropoff_latitude: number
  dropoff_longitude: number
  scheduled_pickup_time: string
  estimated_completion_time: string | null
  total_weight_kg: number
  special_notes: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  customer?: {
    full_name: string | null
    email: string
    phone: string | null
  }
  order_items?: OrderItem[]
  deliveries?: Delivery[]
  order_status_history?: OrderStatusHistory[]
}

export interface OrderItem {
  id: string
  order_id: string
  service_type: 'wash_and_fold' | 'dry_clean' | 'iron_only' | 'express'
  quantity: number
  unit_price: number
  total_price: number
  description: string | null
  created_at: string
}

export interface Delivery {
  id: string
  order_id: string
  driver_id: string | null
  type: 'pickup' | 'delivery'
  status: string
  pickup_photo_urls: string[] | null
  handover_photo_url: string | null
  return_photo_url: string | null
  delivery_photo_urls: string[] | null
  signature_data: Record<string, unknown> | null
  otp_code: string | null
  otp_expires_at: string | null
  note: string | null
  estimated_arrival_time: string | null
  actual_pickup_time: string | null
  actual_delivery_time: string | null
  created_at: string
  updated_at: string
  driver?: {
    id: string
    profile: {
      full_name: string | null
      email: string
      phone: string | null
    }
  }
}

export interface OrderStatusHistory {
  id: number
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  performed_by: string | null
  performed_by_role: 'customer' | 'laundry_owner' | 'admin' | 'driver' | 'system' | null
  metadata: Record<string, unknown> | null
  performed_at: string
}

export interface CapacityLog {
  id: string
  laundry_id: string
  date: string
  total_capacity_kg: number
  used_capacity_kg: number
  remaining_capacity_kg: number
  order_id: string | null
  action: 'deduct' | 'reset' | 'adjust'
  amount_kg: number
  notes: string | null
  created_at: string
}

export interface Laundry {
  id: string
  owner_user_id: string
  business_name: string
  capacity_per_day: number
  status: 'pending_approval' | 'active' | 'rejected' | 'more_info_needed'
}
