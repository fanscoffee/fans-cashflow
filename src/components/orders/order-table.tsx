import type { Order } from "@/types/order"

interface OrderTableProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
}

export default function OrderTable({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
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
                  <div className="flex justify-end gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onEdit(order)}
                        className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(order.id)}
                        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                      >
                        Eliminar
                      </button>
                    )}
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
