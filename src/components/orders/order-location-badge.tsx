import {
  ORDER_DELIVERY_LOCATION_LABELS,
  type OrderDeliveryLocation,
} from "@/types/order"

interface OrderLocationBadgeProps {
  location: OrderDeliveryLocation | null
}

export default function OrderLocationBadge({ location }: OrderLocationBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        location ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {location ? ORDER_DELIVERY_LOCATION_LABELS[location] : "Sin indicar"}
    </span>
  )
}
