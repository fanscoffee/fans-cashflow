"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { type Shift, type ExpenseFormData, expenseSchema } from "@/types/shift"
import { toN } from "@/lib/money"

interface ShiftCardProps {
  shift: Shift
  userRole?: string
  onSave: (shiftId: string, values: { efectivo: number; caixa: number; santander: number; fondoFinal: number }) => Promise<void>
  onClose: (shiftId: string, fondoFinal: number) => Promise<void>
  onReopen: (shiftId: string) => Promise<void>
  closingShift: string | null
  onRefresh: () => Promise<void>
}

export function ShiftCard({ shift, userRole, onSave, onClose, onReopen, closingShift, onRefresh }: ShiftCardProps) {
  const isOpen = shift.status === "ABIERTO"
  const canManageExpenses = userRole === "ADMIN" || userRole === "SOCIO"
  const canEditShift = canManageExpenses || isOpen

  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({ efectivo: "0", caixa: "0", santander: "0" })
  const [addingExpense, setAddingExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<string | null>(null)
  const [editExpenseValues, setEditExpenseValues] = useState<{ proveedor: string; importe: number }>({ proveedor: "", importe: 0 })
  const [openMobileMenu, setOpenMobileMenu] = useState(false)

  const efectivo = isEditing ? Number(editValues.efectivo) || 0 : toN(shift.efectivo)
  const caixa = isEditing ? Number(editValues.caixa) || 0 : toN(shift.caixa)
  const santander = isEditing ? Number(editValues.santander) || 0 : toN(shift.santander)
  const fondoInicial = toN(shift.fondoInicial)
  const totalExpenses = shift.expenses.reduce((sum, e) => sum + toN(e.importe), 0)
  const fondoFinal = fondoInicial - totalExpenses

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
  })

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
      fondoFinal: fondoInicial - totalExpenses,
    })
    setIsEditing(false)
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

  return (
    <div className={`rounded-md border p-4 ${isOpen ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">
            {new Date(shift.date).toLocaleDateString("es-ES")} — {shift.turno}
          </p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
            {isOpen ? "Abierto" : "Cerrado"}
          </span>
          {shift.createdBy && (
            <span className="text-xs text-gray-500">
              — {shift.createdBy.name || shift.createdBy.email}
            </span>
          )}
        </div>
        <div className="relative flex gap-2">
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
                  <button onClick={() => setAddingExpense(!addingExpense)} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
                    {addingExpense ? "Cancelar" : "+ Gasto"}
                  </button>
                  <button onClick={() => onClose(shift.id, fondoFinal)} disabled={closingShift === shift.id} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {closingShift === shift.id ? "Cerrando..." : "Cerrar Turno"}
                  </button>
                </>
              )}
              {!isOpen && canManageExpenses && (
                <button onClick={() => onReopen(shift.id)} className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600">Reabrir</button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpenMobileMenu(!openMobileMenu)}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 sm:hidden"
            >
              ☰
            </button>

            {/* Mobile dropdown */}
            {openMobileMenu && (
              <>
                <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpenMobileMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg sm:hidden">
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
                      <button onClick={() => { setAddingExpense(!addingExpense); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                        {addingExpense ? "Cancelar" : "+ Gasto"}
                      </button>
                      <button onClick={() => { onClose(shift.id, fondoFinal); setOpenMobileMenu(false) }} disabled={closingShift === shift.id} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
                        {closingShift === shift.id ? "Cerrando..." : "Cerrar Turno"}
                      </button>
                    </>
                  )}
                  {!isOpen && canManageExpenses && (
                    <button onClick={() => { onReopen(shift.id); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">Reabrir</button>
                  )}
                </div>
              </>
            )}
          </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
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

      {shift.expenses.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-gray-700">Gastos:</p>
          <div className="space-y-1">
            {shift.expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between text-xs">
                {editingExpense === expense.id ? (
                  <div className="flex flex-1 items-center gap-2">
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
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900"
                    />
                    <button onClick={() => handleEditExpense(expense.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">OK</button>
                    <button onClick={() => setEditingExpense(null)} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300">X</button>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-600">{expense.proveedor}</span>
                    <div className="flex items-center gap-2">
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

      {isOpen && addingExpense && (
        <form
          onSubmit={handleSubmit(async (data) => {
            await fetch(`/api/shifts/${shift.id}/expenses`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            })
            reset()
            setAddingExpense(false)
            await onRefresh()
          })}
          className="mt-3 border-t pt-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              {...register("proveedor")}
              placeholder="Proveedor"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.01"
              {...register("importe", { valueAsNumber: true })}
              placeholder="Importe"
              className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          {(errors.proveedor || errors.importe) && (
            <p className="mt-1 text-xs text-red-500">
              {errors.proveedor?.message || errors.importe?.message}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
