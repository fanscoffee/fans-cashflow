import type { Order } from "@/types/order"
import type { SortField, SortDirection } from "@/hooks/useOrderFilters"
import OrderActions from "./order-actions"

interface SortableHeaderProps {
  field: SortField
  label: string
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
}

function SortableHeader({ field, label, sortField, sortDirection, onSort }: SortableHeaderProps) {
  const isActive = sortField === field
  return (
    <th
      className="cursor-pointer select-none pb-2 hover:text-gray-700"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex w-3 flex-col items-center">
          <svg
            className={`h-2 ${isActive && sortDirection === "asc" ? "text-gray-900" : "text-gray-300"}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 0L10 6H0L5 0Z" />
          </svg>
          <svg
            className={`h-2 -mt-0.5 ${isActive && sortDirection === "desc" ? "text-gray-900" : "text-gray-300"}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 6L0 0H10L5 6Z" />
          </svg>
        </span>
      </div>
    </th>
  )
}

interface OrderTableProps {
  orders: Order[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
  onToggleStatus: (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => void
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
}

export default function OrderTable({
  orders,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
  sortField,
  sortDirection,
  onSort,
}: OrderTableProps) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs font-medium text-gray-500">
            <SortableHeader field="createdAt" label="Creado" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader field="deliveryDate" label="Entrega" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader field="clientName" label="Cliente" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader field="clientPhone" label="Teléfono" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
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
