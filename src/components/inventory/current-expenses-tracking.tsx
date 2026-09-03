"use client"

import { useCallback, useEffect, useState } from "react"
import { CurrentExpenseStatus, PaymentEntity, parseCurrentExpenseStatus, parsePaymentEntity } from "@/lib/database-enums"

interface CurrentExpense {
  id: string
  entity: string
  concept: string
  accrualDate: string
  amount: number | string
  receipt: string
  status: string
  category: { code: string; name: string }
  creditor: { name: string } | null
  requester: { name: string | null; email: string }
  shift: { date: string; shift: string } | null
}

function euros(value: number | string) {
  return `${Number(value || 0).toFixed(2)} €`
}

function statusClass(status: string) {
  const normalized = parseCurrentExpenseStatus(status)
  if (normalized === CurrentExpenseStatus.AUTHORIZED) return "bg-green-100 text-green-800"
  if (normalized === CurrentExpenseStatus.PENDING_AUTHORIZATION) return "bg-amber-100 text-amber-800"
  if (normalized === CurrentExpenseStatus.REJECTED || normalized === CurrentExpenseStatus.VOID) return "bg-red-100 text-red-800"
  if (normalized === CurrentExpenseStatus.PAID) return "bg-blue-100 text-blue-800"
  return "bg-gray-100 text-gray-700"
}

function statusLabel(status: string) {
  const normalized = parseCurrentExpenseStatus(status)
  if (normalized === CurrentExpenseStatus.DRAFT) return "Borrador"
  if (normalized === CurrentExpenseStatus.PENDING_AUTHORIZATION) return "Pendiente de autorización"
  if (normalized === CurrentExpenseStatus.AUTHORIZED) return "Autorizado"
  if (normalized === CurrentExpenseStatus.REJECTED) return "Rechazado"
  if (normalized === CurrentExpenseStatus.PAID) return "Pagado"
  if (normalized === CurrentExpenseStatus.CLOSED) return "Cerrado"
  if (normalized === CurrentExpenseStatus.VOID) return "Anulado"
  return status
}

function entityLabel(entity: string) {
  const normalized = parsePaymentEntity(entity)
  if (normalized === PaymentEntity.BAKERY) return "Obrador"
  if (normalized === PaymentEntity.COFFEE_SHOP) return "Cafetería"
  return entity
}

export default function CurrentExpensesTracking({ canAccess }: { canAccess: boolean }) {
  const [expenses, setExpenses] = useState<CurrentExpense[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadExpenses = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    try {
      const response = await fetch("/api/pagos/gastos")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al cargar gastos corrientes")
      setExpenses(data || [])
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error al cargar gastos corrientes")
    } finally {
      setLoading(false)
    }
  }, [canAccess])

  async function deleteExpense(expense: CurrentExpense) {
    if (!confirm(`¿Eliminar el gasto "${expense.concept}"? Se anulará y dejará de aparecer en el seguimiento.`)) return

    setDeletingId(expense.id)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/pagos/gastos/${expense.id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el gasto corriente")
      setExpenses((current) => current.filter((item) => item.id !== expense.id))
      setSuccess("Gasto corriente eliminado correctamente")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar el gasto corriente")
    } finally {
      setDeletingId(null)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void loadExpenses() }, [loadExpenses])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!canAccess) return null

  const lowerSearch = search.trim().toLowerCase()
  const visibleExpenses = expenses.filter((expense) => {
    if (!lowerSearch) return true
    const requester = expense.requester.name || expense.requester.email
    return [expense.concept, expense.category.name, expense.category.code, expense.creditor?.name, requester, expense.shift?.shift]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(lowerSearch))
  })

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seguimiento de gastos corrientes</h2>
          <p className="text-xs text-gray-500">Gastos registrados desde turnos abiertos; aquí puedes seguir su estado y origen.</p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar concepto, persona..."
          className="w-full min-w-0 rounded-md border px-3 py-2 text-sm text-gray-900 sm:w-56"
        />
      </div>
      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Cargando gastos corrientes...</p>
      ) : visibleExpenses.length === 0 ? (
        <p className="text-sm text-gray-500">No hay gastos corrientes que mostrar.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-left text-sm sm:min-w-0">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Importe</th>
                <th className="px-3 py-2">Solicitante</th>
                <th className="px-3 py-2">Turno</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(expense.accrualDate).toLocaleDateString("es-ES")}</td>
                  <td className="px-3 py-2 text-gray-600">{entityLabel(expense.entity)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{expense.concept}</td>
                  <td className="px-3 py-2 text-gray-600">{expense.category.code} · {expense.category.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{euros(expense.amount)}</td>
                  <td className="px-3 py-2 text-gray-600">{expense.requester.name || expense.requester.email}</td>
                  <td className="px-3 py-2 text-gray-600">{expense.shift ? `${expense.shift.shift} · ${new Date(expense.shift.date).toLocaleDateString("es-ES")}` : "Sin turno"}</td>
                  <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(expense.status)}`}>{statusLabel(expense.status)}</span></td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void deleteExpense(expense)}
                      disabled={deletingId === expense.id}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === expense.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
