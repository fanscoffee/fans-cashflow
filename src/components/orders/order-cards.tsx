import type { Order } from "@/types/order"
import OrderActions from "./order-actions"

interface OrderCardsProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
  onToggleStatus: (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => void
}

export default function OrderCards({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
}: OrderCardsProps) {
  return (
    <div className="space-y-3 sm:hidden">
      {orders.map((order) => {
        const delivery = new Date(order.deliveryDate)
        const created = new Date(order.createdAt)
        return (
          <div
            key={order.id}
            className="min-w-0 rounded-md border border-gray-200 bg-gray-50 p-3 sm:p-4"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-gray-900 [overflow-wrap:anywhere]">{order.clientName}</p>
                <p className="break-words text-sm text-gray-700 [overflow-wrap:anywhere]">{order.clientPhone}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {order.isPaid && (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    Pagado
                  </span>
                )}
                {order.isDelivered && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Entregado
                  </span>
                )}
                <OrderActions
                  order={order}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-800 min-[360px]:grid-cols-2">
              <div>
                <span className="text-gray-700">Entrega:</span>{" "}
                {delivery.toLocaleDateString("es-ES")}{" "}
                {delivery.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div>
                <span className="text-gray-700">Creado:</span>{" "}
                {created.toLocaleDateString("es-ES")}
              </div>
              {order.comment && (
                <div className="min-w-0 min-[360px]:col-span-2">
                  <span className="text-gray-700">Comentario:</span> {order.comment}
                </div>
              )}
              {order.createdBy && (
                <div className="min-w-0 break-words text-xs text-gray-600 [overflow-wrap:anywhere] min-[360px]:col-span-2">
                  Por: {order.createdBy.name || order.createdBy.email}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
