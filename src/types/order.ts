export const ORDER_DELIVERY_LOCATIONS = ["OBRADOR", "CAFETERIA"] as const

export type OrderDeliveryLocation = (typeof ORDER_DELIVERY_LOCATIONS)[number]

export const ORDER_DELIVERY_LOCATION_LABELS: Record<OrderDeliveryLocation, string> = {
  OBRADOR: "Obrador",
  CAFETERIA: "Cafetería",
}

export function isOrderDeliveryLocation(value: string): value is OrderDeliveryLocation {
  return ORDER_DELIVERY_LOCATIONS.some((location) => location === value)
}

export interface Order {
  id: string
  clientName: string
  clientPhone: string
  deliveryDate: string
  deliveryLocation: OrderDeliveryLocation | null
  comment: string | null
  isPaid: boolean
  isDelivered: boolean
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

export interface OrderFormData {
  clientName: string
  clientPhone: string
  deliveryDate: string
  deliveryTime: string
  deliveryLocation: OrderDeliveryLocation
  comment: string
}
