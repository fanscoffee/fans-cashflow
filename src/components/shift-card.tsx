"use client"

import { useState, type FormEvent } from "react"
import type { Shift } from "@/types/shift"
import { toN } from "@/lib/money"
import { calculateFondoFinal, calculateTotalExpenses } from "@/lib/fondo"
import CierreTurnoModal, { type CierreTurnoFormData } from "@/components/cierre-turno-modal"

interface ShiftCardProps {
  shift: Shift
  userRole?: string
  onSave: (shiftId: string, values: { efectivo: number; caixa: number; santander: number; fondoFinal: number }) => Promise<void>
  onClose: (shiftId: string, data: CierreTurnoFormData) => Promise<boolean>
  onReopen: (shiftId: string) => Promise<void>
  closingShift: string | null
  onRefresh: () => Promise<void>
}

interface ExpenseCategoryOption {
  id: string
  codigo: string
  nombre: string
}

interface ExpenseCreditorOption {
  id: string
  codigo: string
  nombre: string
  tipo: string
}

export function ShiftCard({ shift, userRole, onSave, onClose, onReopen, closingShift, onRefresh }: ShiftCardProps) {
  const isOpen = shift.status === "ABIERTO"
  const canManageExpenses = userRole === "ADMIN" || userRole === "SOCIO"
  const canEditShift = canManageExpenses || isOpen

  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({ efectivo: "0", caixa: "0", santander: "0" })
  const [editingExpense, setEditingExpense] = useState<string | null>(null)
  const [editExpenseValues, setEditExpenseValues] = useState<{ proveedor: string; importe: number }>({ proveedor: "", importe: 0 })
  const [addingCurrentExpense, setAddingCurrentExpense] = useState(false)
  const [currentExpenseCategories, setCurrentExpenseCategories] = useState<ExpenseCategoryOption[]>([])
  const [currentExpenseCreditors, setCurrentExpenseCreditors] = useState<ExpenseCreditorOption[]>([])
  const [currentExpenseValues, setCurrentExpenseValues] = useState({ categoriaId: "", acreedorId: "", concepto: "", importe: "" })
  const [loadingCurrentExpenseOptions, setLoadingCurrentExpenseOptions] = useState(false)
  const [savingCurrentExpense, setSavingCurrentExpense] = useState(false)
  const [currentExpenseError, setCurrentExpenseError] = useState("")
  const [currentExpenseSuccess, setCurrentExpenseSuccess] = useState("")
  const [openMobileMenu, setOpenMobileMenu] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

  const efectivo = isEditing ? Number(editValues.efectivo) || 0 : toN(shift.efectivo)
  const caixa = isEditing ? Number(editValues.caixa) || 0 : toN(shift.caixa)
  const santander = isEditing ? Number(editValues.santander) || 0 : toN(shift.santander)
  const fondoInicial = toN(shift.fondoInicial)
  const currentExpenses = shift.gastosCorrientes || []
  const totalExpenses = calculateTotalExpenses(shift.expenses, currentExpenses)
  const fondoFinal = calculateFondoFinal(fondoInicial, shift.expenses, currentExpenses)

  function startEditing() {
    setIsEditing(true)
    setEditValues({ efectivo: String(efectivo), caixa: String(caixa), santander: String(santander) })
  }

  function cancelEditing() {
    setIsEditing(false)
  }

  function saveEditing() {
    onSave(shift.id, {
      efectivo: parseFloat(editValues.efectivo) || 0,
      caixa: parseFloat(editValues.caixa) || 0,
      santander: parseFloat(editValues.santander) || 0,
      fondoFinal: calculateFondoFinal(fondoInicial, shift.expenses, currentExpenses),
    })
    setIsEditing(false)
  }

  async function submitClose(data: CierreTurnoFormData) {
    const saved = await onClose(shift.id, data)
    if (saved) setShowCloseModal(false)
  }

  async function handleEditExpense(expenseId: string) {
    await fetch(`/api/shifts/${shift.id}/expenses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId, proveedor: editExpenseValues.proveedor, importe: editExpenseValues.importe }),
    })
    setEditingExpense(null)
    await onRefresh()
  }

  async function handleDeleteExpense(expenseId: string) {
    await fetch(`/api/shifts/${shift.id}/expenses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId }),
    })
    await onRefresh()
  }

  async function openCurrentExpenseForm() {
    setAddingCurrentExpense(true)
    setCurrentExpenseError("")
    setCurrentExpenseSuccess("")
    if (currentExpenseCategories.length > 0) return

    setLoadingCurrentExpenseOptions(true)
    try {
      const response = await fetch(`/api/shifts/${shift.id}/gastos`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo cargar el formulario")
      const personal = result.categorias?.find((category: ExpenseCategoryOption) => category.codigo === "PER")
      setCurrentExpenseCategories(result.categorias || [])
      setCurrentExpenseCreditors(result.acreedores || [])
      setCurrentExpenseValues((current) => ({ ...current, categoriaId: current.categoriaId || personal?.id || result.categorias?.[0]?.id || "" }))
    } catch (reason) {
      setCurrentExpenseError(reason instanceof Error ? reason.message : "No se pudo cargar el formulario")
    } finally {
      setLoadingCurrentExpenseOptions(false)
    }
  }

  function closeCurrentExpenseForm() {
    setAddingCurrentExpense(false)
    setCurrentExpenseError("")
    setCurrentExpenseSuccess("")
  }

  async function submitCurrentExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingCurrentExpense(true)
    setCurrentExpenseError("")
    setCurrentExpenseSuccess("")
    try {
      const response = await fetch(`/api/shifts/${shift.id}/gastos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoriaId: currentExpenseValues.categoriaId,
          acreedorId: currentExpenseValues.acreedorId || undefined,
          concepto: currentExpenseValues.concepto,
          fechaDevengo: new Date().toISOString().slice(0, 10),
          importe: Number(currentExpenseValues.importe),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el gasto")
      setCurrentExpenseSuccess("Gasto guardado correctamente y enviado a autorización")
      setAddingCurrentExpense(false)
      setCurrentExpenseValues((current) => ({ ...current, concepto: "", importe: "" }))
      await onRefresh()
    } catch (reason) {
      setCurrentExpenseError(reason instanceof Error ? reason.message : "No se pudo registrar el gasto")
    } finally {
      setSavingCurrentExpense(false)
    }
  }

  return (
    <div className={`rounded-md border p-3 sm:p-4 ${isOpen ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium text-gray-900">
            {new Date(shift.date).toLocaleDateString("es-ES")} — {shift.turno}
          </p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
            {isOpen ? "Abierto" : "Cerrado"}
          </span>
          {shift.createdBy && (
            <span className="break-words text-xs text-gray-500 [overflow-wrap:anywhere]">
              — {shift.createdBy.name || shift.createdBy.email}
            </span>
          )}
        </div>
        <div className="relative flex w-full justify-end gap-2 sm:w-auto">
            {/* Desktop buttons */}
            <div className="hidden gap-2 sm:flex">
              {canEditShift && !isEditing && (
                <button onClick={startEditing} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">Editar</button>
              )}
              {canEditShift && isEditing && (
                <>
                  <button onClick={saveEditing} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">Guardar</button>
                  <button onClick={cancelEditing} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">Cancelar</button>
                </>
              )}
              {isOpen && (
                <>
                  <button type="button" onClick={() => void openCurrentExpenseForm()} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">+ Gasto corriente</button>
                  <button onClick={() => setShowCloseModal(true)} disabled={closingShift === shift.id} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {closingShift === shift.id ? "Cerrando..." : "Cerrar Turno"}
                  </button>
                </>
              )}
              {!isOpen && userRole === "SOCIO" && (
                <button onClick={() => onReopen(shift.id)} className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600">Reabrir</button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpenMobileMenu(!openMobileMenu)}
              className="min-h-11 min-w-11 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 sm:hidden"
              aria-label="Acciones del turno"
              aria-expanded={openMobileMenu}
            >
              ☰
            </button>

            {/* Mobile dropdown */}
            {openMobileMenu && (
              <>
                <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpenMobileMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 max-h-[calc(100dvh-5rem)] w-48 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg sm:hidden">
                  {canEditShift && !isEditing && (
                    <button onClick={() => { startEditing(); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Editar</button>
                  )}
                  {canEditShift && isEditing && (
                    <>
                      <button onClick={() => { saveEditing(); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50">Guardar</button>
                      <button onClick={() => { cancelEditing(); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                    </>
                  )}
                  {isOpen && (
                    <>
                       <button type="button" onClick={() => { void openCurrentExpenseForm(); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">+ Gasto corriente</button>
                       <button onClick={() => { setShowCloseModal(true); setOpenMobileMenu(false) }} disabled={closingShift === shift.id} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
                        {closingShift === shift.id ? "Cerrando..." : "Cerrar Turno"}
                      </button>
                    </>
                  )}
                   {!isOpen && userRole === "SOCIO" && (
                    <button onClick={() => { onReopen(shift.id); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">Reabrir</button>
                  )}
                </div>
              </>
            )}
          </div>
       </div>

      {currentExpenseSuccess && (
        <div role="status" aria-live="polite" className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {currentExpenseSuccess}
        </div>
      )}

       <div className="mt-3 grid grid-cols-1 gap-2 text-sm min-[360px]:grid-cols-2 md:grid-cols-3">
        <div>
          <span className="text-gray-500">F. Inicial:</span>{" "}
          <span className="font-medium text-gray-900">{fondoInicial.toFixed(2)}</span>
        </div>
        {isEditing ? (
          <>
            <div>
              <label className="text-gray-500">Efectivo:</label>
              <input
                type="number"
                step="0.01"
                value={editValues.efectivo}
                onChange={(e) => setEditValues({ ...editValues, efectivo: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-500">Caixa:</label>
              <input
                type="number"
                step="0.01"
                value={editValues.caixa}
                onChange={(e) => setEditValues({ ...editValues, caixa: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-500">Santander:</label>
              <input
                type="number"
                step="0.01"
                value={editValues.santander}
                onChange={(e) => setEditValues({ ...editValues, santander: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-gray-500">Efectivo:</span>{" "}
              <span className="font-medium text-gray-900">{efectivo.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Caixa:</span>{" "}
              <span className="font-medium text-gray-900">{caixa.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Santander:</span>{" "}
              <span className="font-medium text-gray-900">{santander.toFixed(2)}</span>
            </div>
          </>
        )}
        <div>
          <span className="text-gray-500">Gastos:</span>{" "}
          <span className="font-medium text-gray-900">{totalExpenses.toFixed(2)}</span>
        </div>
        <div className="col-span-2 md:col-span-3">
          <span className="text-gray-500">F. Final:</span>{" "}
          <span className={`font-bold ${fondoFinal >= 0 ? "text-green-700" : "text-red-700"}`}>{fondoFinal.toFixed(2)}</span>
        </div>
      </div>

      {shift.cierreTurno ? (
        <div className="mt-3 break-words rounded-md border border-green-100 bg-green-50 p-2 text-xs text-green-800 [overflow-wrap:anywhere]">
          Ticket {shift.cierreTurno.tpv} · cierre {shift.cierreTurno.numeroCierreCaja} · ventas netas {toN(shift.cierreTurno.ventasNetas).toFixed(2)} €
        </div>
      ) : !isOpen ? (
        <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
          Turno histórico sin ticket de cierre registrado.
        </div>
      ) : null}

      {shift.expenses.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-gray-700">Gastos:</p>
          <div className="space-y-1">
            {shift.expenses.map((expense) => (
              <div key={expense.id} className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                {editingExpense === expense.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={editExpenseValues.proveedor}
                      onChange={(e) => setEditExpenseValues({ ...editExpenseValues, proveedor: e.target.value })}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editExpenseValues.importe}
                      onChange={(e) => setEditExpenseValues({ ...editExpenseValues, importe: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 sm:w-20"
                    />
                    <button onClick={() => handleEditExpense(expense.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">OK</button>
                    <button onClick={() => setEditingExpense(null)} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300">X</button>
                  </div>
                ) : (
                  <>
                     <span className="min-w-0 break-words text-gray-600 [overflow-wrap:anywhere]">{expense.proveedor}</span>
                     <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium text-gray-900">{toN(expense.importe).toFixed(2)}</span>
                      {canManageExpenses && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingExpense(expense.id); setEditExpenseValues({ proveedor: expense.proveedor, importe: toN(expense.importe) }) }}
                            className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-300"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-200"
                          >
                            X
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentExpenses.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-gray-700">Gastos corrientes</p>
            <span className="text-xs text-gray-500">Incluidos en el fondo del turno</span>
          </div>
          <div className="space-y-1">
            {currentExpenses.map((expense) => (
              <div key={expense.id} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium text-gray-900 [overflow-wrap:anywhere]">{expense.concepto}</p>
                  <p className="break-words text-gray-500 [overflow-wrap:anywhere]">{expense.categoria.codigo} · {expense.estado === "PENDIENTE_AUTORIZACION" ? "Pendiente de autorización" : expense.estado} · {expense.solicitante.name || expense.solicitante.email}</p>
                </div>
                <span className="shrink-0 self-end whitespace-nowrap font-medium text-gray-900 sm:self-auto">{toN(expense.importe).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && addingCurrentExpense && (
        <form onSubmit={submitCurrentExpense} className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs text-gray-600">Se registra en CAFETERIA, sin archivo, y queda pendiente de autorización.</p>
          {loadingCurrentExpenseOptions ? (
            <p className="text-xs text-gray-500">Cargando categorías...</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-gray-700">
                Categoría
                <select
                  value={currentExpenseValues.categoriaId}
                  onChange={(event) => setCurrentExpenseValues({ ...currentExpenseValues, categoriaId: event.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {currentExpenseCategories.map((category) => <option key={category.id} value={category.id}>{category.codigo} · {category.nombre}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-700">
                Acreedor <span className="text-gray-400">(opcional para Personal/MEN)</span>
                <select
                  value={currentExpenseValues.acreedorId}
                  onChange={(event) => setCurrentExpenseValues({ ...currentExpenseValues, acreedorId: event.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                >
                  <option value="">Sin acreedor</option>
                  {currentExpenseCreditors.map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.nombre} · {creditor.tipo}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-700 sm:col-span-2">
                Concepto
                <input
                  value={currentExpenseValues.concepto}
                  onChange={(event) => setCurrentExpenseValues({ ...currentExpenseValues, concepto: event.target.value })}
                  placeholder="Ej.: Horas extras de Juan"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  required
                />
              </label>
              <label className="text-xs text-gray-700">
                Importe
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={currentExpenseValues.importe}
                  onChange={(event) => setCurrentExpenseValues({ ...currentExpenseValues, importe: event.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  required
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <button type="submit" disabled={savingCurrentExpense} className="w-full rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:py-1.5">
                  {savingCurrentExpense ? "Guardando..." : "Guardar gasto"}
                </button>
                <button type="button" onClick={closeCurrentExpenseForm} className="w-full rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 sm:w-auto sm:py-1.5">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {currentExpenseError && <p className="mt-2 text-xs text-red-600">{currentExpenseError}</p>}
        </form>
      )}
      {showCloseModal && (
        <CierreTurnoModal
          shift={shift}
          initialCierre={shift.cierreTurno}
          requirePhoto={!shift.cierreTurno}
          onCancel={() => setShowCloseModal(false)}
          onSubmit={submitClose}
          saving={closingShift === shift.id}
        />
      )}
    </div>
  )
}
