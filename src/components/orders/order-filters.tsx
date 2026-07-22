import { downloadCSV } from "@/lib/csv"
import { MONTH_NAMES } from "@/lib/constants"
import type { Order } from "@/types/order"

interface OrderFiltersProps {
  selectedMonth: number
  selectedYear: number
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
  orders: Order[]
}

export default function OrderFilters({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  orders,
}: OrderFiltersProps) {
  function handleExport() {
    const data = orders.map((order) => {
      const delivery = new Date(order.deliveryDate)
      const created = new Date(order.createdAt)
      return {
        Creado: created.toLocaleDateString("es-ES"),
        Entrega: delivery.toLocaleDateString("es-ES"),
        HoraEntrega: delivery.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        Cliente: order.clientName,
        Telefono: order.clientPhone,
        Comentario: order.comment || "",
        CreadoPor: order.createdBy?.name || order.createdBy?.email || "",
      }
    })
    const filename = `encargos-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data, filename)
  }

  return (
    <>
      <select
        value={selectedMonth}
        onChange={(e) => onMonthChange(parseInt(e.target.value))}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={selectedYear}
        onChange={(e) => onYearChange(parseInt(e.target.value))}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {[
          new Date().getFullYear(),
          new Date().getFullYear() - 1,
          new Date().getFullYear() - 2,
        ].map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        onClick={handleExport}
        disabled={orders.length === 0}
        className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Exportar
      </button>
    </>
  )
}
