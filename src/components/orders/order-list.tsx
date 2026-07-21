import type { Order } from "@/types/order"
import OrderTable from "./order-table"
import OrderCards from "./order-cards"

interface OrderListProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
}

export default function OrderList({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: OrderListProps) {
  return (
    <>
      <OrderCards
        orders={orders}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <OrderTable
        orders={orders}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  )
}
