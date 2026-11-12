"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CreditorType, CurrentExpenseStatus, ExpenseReceiptType, PaymentEntity, parseCurrentExpenseStatus, parsePaymentEntity, type DatabaseExpenseReceiptType, type DatabasePaymentEntity } from "@/lib/database-enums"

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

interface ExpenseCategoryOption {
  id: string
  code: string
  name: string
}

interface ExpenseCreditorOption {
  id: string
  code: string
  name: string
  type: string
}

interface ExtraExpenseForm {
  entity: DatabasePaymentEntity
  categoryId: string
  creditorId: string
  concept: string
  accrualDate: string
  amount: string
  receipt: DatabaseExpenseReceiptType
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

function receiptLabel(receipt: string) {
  if (receipt === ExpenseReceiptType.NO_RECEIPT || receipt === "SIN_JUSTIFICANTE") return "Sin factura / justificante"
  if (receipt === ExpenseReceiptType.RECEIPT || receipt === "RECIBO") return "Recibo"
  if (receipt === ExpenseReceiptType.TICKET) return "Ticket"
  if (receipt === ExpenseReceiptType.CONTRACT || receipt === "CONTRATO") return "Contrato"
  if (receipt === ExpenseReceiptType.INTERNAL_VOUCHER || receipt === "VALE_INTERNO") return "Vale interno"
  if (receipt === ExpenseReceiptType.INVOICE || receipt === "FACTURA") return "Factura"
  return receipt
}

function emptyExtraExpense(): ExtraExpenseForm {
  return {
    entity: PaymentEntity.COFFEE_SHOP,
    categoryId: "",
    creditorId: "",
    concept: "",
    accrualDate: new Date().toISOString().slice(0, 10),
    amount: "",
    receipt: ExpenseReceiptType.NO_RECEIPT,
  }
}

export default function CurrentExpensesTracking({ canAccess }: { canAccess: boolean }) {
  const [expenses, setExpenses] = useState<CurrentExpense[]>([])
  const [search, setSearch] = useState("")
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraExpenseForm, setExtraExpenseForm] = useState<ExtraExpenseForm>(() => emptyExtraExpense())
  const [categories, setCategories] = useState<ExpenseCategoryOption[]>([])
  const [creditors, setCreditors] = useState<ExpenseCreditorOption[]>([])
  const [optionsEntity, setOptionsEntity] = useState<DatabasePaymentEntity | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [savingExtraExpense, setSavingExtraExpense] = useState(false)
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

  async function loadExpenseOptions(entity: DatabasePaymentEntity) {
    setOptionsLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/pagos/configuracion?entity=${entity}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las opciones del gasto")
      const nextCategories = (data.categories || []) as ExpenseCategoryOption[]
      const nextCreditors = ((data.creditors || []) as ExpenseCreditorOption[]).filter((creditor) => creditor.type !== CreditorType.MERCHANDISE_SUPPLIER)
      setCategories(nextCategories)
      setCreditors(nextCreditors)
      setOptionsEntity(entity)
      setExtraExpenseForm((current) => ({
        ...current,
        categoryId: nextCategories.some((category) => category.id === current.categoryId) ? current.categoryId : "",
        creditorId: nextCreditors.some((creditor) => creditor.id === current.creditorId) ? current.creditorId : "",
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las opciones del gasto")
    } finally {
      setOptionsLoading(false)
    }
  }

  async function openExtraExpenseForm() {
    setShowExtraForm(true)
    setSuccess("")
    setError("")
    if (optionsEntity !== extraExpenseForm.entity) await loadExpenseOptions(extraExpenseForm.entity)
  }

  function closeExtraExpenseForm() {
    setShowExtraForm(false)
    setError("")
  }

  async function submitExtraExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingExtraExpense(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch("/api/pagos/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...extraExpenseForm,
          amount: Number(extraExpenseForm.amount),
          creditorId: extraExpenseForm.creditorId || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el gasto extra")
      setShowExtraForm(false)
      setExtraExpenseForm((current) => ({ ...emptyExtraExpense(), entity: current.entity }))
      setSuccess("Gasto extra registrado y enviado a autorización")
      await loadExpenses()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el gasto extra")
    } finally {
      setSavingExtraExpense(false)
    }
  }

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
    return [expense.concept, expense.category.name, expense.category.code, expense.creditor?.name, requester, expense.shift?.shift, receiptLabel(expense.receipt)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(lowerSearch))
  })

  const selectedCategory = categories.find((category) => category.id === extraExpenseForm.categoryId)
  const creditorRequired = Boolean(selectedCategory && selectedCategory.code !== "PER" && !(selectedCategory.code === "MEN" && extraExpenseForm.receipt === ExpenseReceiptType.NO_RECEIPT))

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seguimiento de gastos corrientes</h2>
          <p className="text-xs text-gray-500">Gastos de turnos y gastos extra sin turno ni factura; aquí puedes seguir su estado y origen.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar concepto, persona..."
            className="w-full min-w-0 rounded-md border px-3 py-2 text-sm text-gray-900 sm:w-56"
          />
          <button type="button" onClick={() => void openExtraExpenseForm()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Gasto extra</button>
        </div>
      </div>
      {error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
      {showExtraForm && (
        <form onSubmit={submitExtraExpense} className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold text-blue-950">Registrar gasto extra</h3>
              <p className="text-xs text-blue-800">No se vincula a un turno ni a una factura y queda pendiente de autorización.</p>
            </div>
            <button type="button" onClick={closeExtraExpenseForm} className="self-start rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs text-gray-700">Cancelar</button>
          </div>
          {optionsLoading ? <p className="text-sm text-blue-800">Cargando categorías y acreedores...</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-gray-700">Entidad<select value={extraExpenseForm.entity} onChange={(event) => { const entity = event.target.value as DatabasePaymentEntity; setExtraExpenseForm((current) => ({ ...current, entity, categoryId: "", creditorId: "" })); void loadExpenseOptions(entity) }} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value={PaymentEntity.COFFEE_SHOP}>Cafetería</option><option value={PaymentEntity.BAKERY}>Obrador</option></select></label>
              <label className="text-xs text-gray-700">Fecha<input type="date" value={extraExpenseForm.accrualDate} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, accrualDate: event.target.value }))} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label>
              <label className="text-xs text-gray-700">Categoría<select value={extraExpenseForm.categoryId} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, categoryId: event.target.value }))} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar categoría...</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.code} · {category.name}</option>)}</select></label>
              <label className="text-xs text-gray-700">Justificante<select value={extraExpenseForm.receipt} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, receipt: event.target.value as DatabaseExpenseReceiptType }))} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value={ExpenseReceiptType.NO_RECEIPT}>Sin factura / justificante</option><option value={ExpenseReceiptType.RECEIPT}>Recibo</option><option value={ExpenseReceiptType.TICKET}>Ticket</option><option value={ExpenseReceiptType.CONTRACT}>Contrato</option><option value={ExpenseReceiptType.INTERNAL_VOUCHER}>Vale interno</option></select></label>
              <label className="text-xs text-gray-700">Acreedor {creditorRequired ? <span className="text-red-600">*</span> : <span className="text-gray-400">(opcional)</span>}<select value={extraExpenseForm.creditorId} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, creditorId: event.target.value }))} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required={creditorRequired}><option value="">Sin acreedor</option>{creditors.map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.name}</option>)}</select></label>
              <label className="text-xs text-gray-700">Importe<input type="number" min="0.01" step="0.01" value={extraExpenseForm.amount} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label>
              <label className="text-xs text-gray-700 sm:col-span-2 lg:col-span-3">Concepto<input value={extraExpenseForm.concept} onChange={(event) => setExtraExpenseForm((current) => ({ ...current, concept: event.target.value }))} placeholder="Ej.: Compra urgente de material de limpieza" className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" minLength={2} maxLength={120} required /></label>
              <div className="flex items-end sm:col-span-2 lg:col-span-3"><button type="submit" disabled={savingExtraExpense || optionsLoading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{savingExtraExpense ? "Guardando..." : "Guardar gasto extra"}</button></div>
            </div>
          )}
        </form>
      )}
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
                <th className="px-3 py-2">Justificante</th>
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
                  <td className="px-3 py-2 text-gray-600">{receiptLabel(expense.receipt)}</td>
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
