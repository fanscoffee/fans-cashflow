import type { Order } from "@/types/order"
import OrderActions from "./order-actions"

interface OrderTableProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
  onToggleStatus: (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => void
}

export default function OrderTable({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
}: OrderTableProps) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs font-medium text-gray-500">
            <th className="pb-2">Creado</th>
            <th className="pb-2">Entrega</th>
            <th className="pb-2">Cliente</th>
            <th className="pb-2">Teléfono</th>
            <th className="pb-2">Comentario</th>
            <th className="pb-2">Creado por</th>
            <th className="pb-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => {
            const delivery = new Date(order.deliveryDate)
            const created = new Date(order.createdAt)
            return (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="py-3 text-gray-900">
                  {created.toLocaleDateString("es-ES")}
                </td>
                <td className="py-3 text-gray-900">
                  {delivery.toLocaleDateString("es-ES")}{" "}
                  {delivery.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 font-medium text-gray-900">{order.clientName}</td>
                <td className="py-3 text-gray-900">{order.clientPhone}</td>
                <td className="max-w-[200px] truncate py-3 text-gray-600">
                  {order.comment || "—"}
                </td>
                <td className="py-3 text-gray-600">
                  {order.createdBy?.name || order.createdBy?.email || "—"}
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
