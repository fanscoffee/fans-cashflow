import type { Order } from "@/types/order"
import type { SortField, SortDirection } from "@/hooks/useOrderFilters"
import OrderTable from "./order-table"
import OrderCards from "./order-cards"

interface OrderListProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
  onToggleStatus: (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => void
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  showCouponBadge?: boolean
}

export default function OrderList({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
  sortField,
  sortDirection,
  onSort,
  showCouponBadge = false,
}: OrderListProps) {
  return (
    <>
      <OrderCards
        orders={orders}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        showCouponBadge={showCouponBadge}
      />
      <OrderTable
        orders={orders}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={onSort}
        showCouponBadge={showCouponBadge}
      />
    </>
  )
}
