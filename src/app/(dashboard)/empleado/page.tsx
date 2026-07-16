"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signOut, useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import PasskeyManager from "@/components/passkey-manager"

const shiftSchema = z.object({
  turno: z.enum(["mañana", "tarde"], { message: "Selecciona un turno" }),
})

type ShiftFormData = z.infer<typeof shiftSchema>

const expenseSchema = z.object({
  proveedor: z.string().min(1, "El proveedor es obligatorio"),
  importe: z.number().min(0.01, "El importe debe ser mayor a 0"),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface Expense {
  id: string
  proveedor: string
  importe: number
}

interface Shift {
  id: string
  date: string
  turno: string
  status: string
  efectivo: number
  caixa: number
  santander: number
  efectivoGasto: number
  fondoInicial: number
  fondoFinal: number
  expenses: Expense[]
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

const TIMEOUT_MS = 2 * 60 * 1000

export default function EmpleadoPage() {
  const { data: session, status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [addingExpenseTo, setAddingExpenseTo] = useState<string | null>(null)
  const [closingShift, setClosingShift] = useState<string | null>(null)
  const [editingShift, setEditingShift] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ efectivo: string; caixa: string; santander: string }>({ efectivo: "0", caixa: "0", santander: "0" })
  const [fundAdditions, setFundAdditions] = useState<{ id: string; amount: number; description: string | null; createdAt: string }[]>([])
  const [fondoInicialServer, setFondoInicialServer] = useState<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fondoInicialLocal = (() => {
    const lastShift = shifts[0]
    const lastShiftDate = lastShift ? new Date(lastShift.createdAt) : new Date(0)
    const additionsSince = fundAdditions.filter((a) => new Date(a.createdAt) > lastShiftDate)
    const totalAdditions = additionsSince.reduce((sum, a) => sum + Number(a.amount), 0)
    return (lastShift ? Number(lastShift.fondoFinal) : 0) + totalAdditions
  })()

  const fondoInicial = fondoInicialServer ?? fondoInicialLocal

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/login" })
    }, TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (session?.user?.role !== "EMPLEADO") return
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [resetTimer, session?.user?.role])

  const refreshData = useCallback(async () => {
    const [shiftsRes, additionsRes, fundRes] = await Promise.all([
      fetch("/api/shifts"),
      fetch("/api/fund-additions"),
      fetch("/api/fund"),
    ])
    if (shiftsRes.ok) {
      const data = await shiftsRes.json()
      setShifts(data)
    }
    if (additionsRes.ok) {
      const additions = await additionsRes.json()
      setFundAdditions(additions)
    }
    if (fundRes.ok) {
      const fundData = await fundRes.json()
      setFondoInicialServer(fundData.fondo)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [shiftsRes, additionsRes, fundRes] = await Promise.all([
          fetch("/api/shifts"),
          fetch("/api/fund-additions"),
          fetch("/api/fund"),
        ])
        if (shiftsRes.ok && !cancelled) {
          const data = await shiftsRes.json()
          setShifts(data)
        }
        if (additionsRes.ok && !cancelled) {
          const additions = await additionsRes.json()
          setFundAdditions(additions)
        }
        if (fundRes.ok && !cancelled) {
          const fundData = await fundRes.json()
          setFondoInicialServer(fundData.fondo)
        }
      } catch {
        if (!cancelled) setError("Error al cargar los datos")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (status === "authenticated") load()
    return () => { cancelled = true }
  }, [status])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      turno: "mañana",
    },
  })

  async function onSubmitShift(data: ShiftFormData) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, date: new Date().toISOString().split("T")[0] }),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al crear el turno")
        return
      }

      setSuccess("Turno abierto correctamente")
      reset()
      await refreshData()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleAddExpense(shiftId: string, data: ExpenseFormData) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shifts/${shiftId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al agregar el gasto")
        return
      }

      setSuccess("Gasto agregado correctamente")
      setAddingExpenseTo(null)
      await refreshData()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleSaveShift(shiftId: string, values: { efectivo: number; caixa: number; santander: number; fondoFinal: number }) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al guardar el turno")
        return
      }

      setSuccess("Turno guardado correctamente")
      setEditingShift(null)
      await refreshData()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  async function handleCloseShift(shiftId: string, fondoFinal: number) {
    setError(null)
    setSuccess(null)
    setClosingShift(shiftId)

    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CERRADO", fondoFinal }),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al cerrar el turno")
        return
      }

      setSuccess("Turno cerrado correctamente")
      await refreshData()
    } catch {
      setError("Error al conectar con el servidor")
    } finally {
      setClosingShift(null)
    }
  }

  async function handleReopenShift(shiftId: string) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ABIERTO" }),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al reabrir el turno")
        return
      }

      setSuccess("Turno reabierto correctamente")
      await refreshData()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  const hasOpenShift = shifts.some((s) => s.status === "ABIERTO")
  const isReadOnly = session?.user?.role === "ADMIN"

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Fans Cashflow"
        subtitle={isReadOnly ? "Turnos" : `Hola, ${session?.user?.name || session?.user?.email}`}
      />

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
        )}

        {!isReadOnly && <PasskeyManager />}

        {isReadOnly && hasOpenShift && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Hay un turno abierto.
          </div>
        )}

        {!isReadOnly && hasOpenShift && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Hay un turno abierto. Espera a que se cierre para abrir uno nuevo.
          </div>
        )}

        {!isReadOnly && (
          <section className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Abrir Turno</h2>
            <form onSubmit={handleSubmit(onSubmitShift)} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  readOnly
                  value={new Date().toISOString().split("T")[0]}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Turno</label>
                <select
                  {...register("turno")}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
                {formErrors.turno && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.turno.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Fondo Inicial</label>
                <input
                  type="text"
                  readOnly
                  value={fondoInicial.toFixed(2)}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || hasOpenShift}
                className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? "Abriendo..." : "Abrir Turno"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{isReadOnly ? "Todos los Turnos" : "Mis Turnos"}</h2>
          {shifts.length === 0 ? (
            <p className="text-sm text-gray-500">{isReadOnly ? "No hay turnos registrados." : "No tienes turnos registrados."}</p>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  userRole={session?.user?.role}
                  editingShift={editingShift}
                  setEditingShift={setEditingShift}
                  editValues={editValues}
                  setEditValues={setEditValues}
                  onSave={handleSaveShift}
                  onClose={handleCloseShift}
                  onReopen={handleReopenShift}
                  closingShift={closingShift}
                  addingExpenseTo={addingExpenseTo}
                  setAddingExpenseTo={setAddingExpenseTo}
                  onAddExpense={handleAddExpense}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function ShiftCard({
  shift,
  userRole,
  editingShift,
  setEditingShift,
  editValues,
  setEditValues,
  onSave,
  onClose,
  onReopen,
  closingShift,
  addingExpenseTo,
  setAddingExpenseTo,
  onAddExpense,
}: {
  shift: Shift
  userRole?: string
  editingShift: string | null
  setEditingShift: (id: string | null) => void
  editValues: { efectivo: string; caixa: string; santander: string }
  setEditValues: (v: { efectivo: string; caixa: string; santander: string }) => void
  onSave: (shiftId: string, values: { efectivo: number; caixa: number; santander: number; fondoFinal: number }) => Promise<void>
  onClose: (shiftId: string, fondoFinal: number) => Promise<void>
  onReopen: (shiftId: string) => Promise<void>
  closingShift: string | null
  addingExpenseTo: string | null
  setAddingExpenseTo: (id: string | null) => void
  onAddExpense: (shiftId: string, data: ExpenseFormData) => Promise<void>
}) {
  const isOpen = shift.status === "ABIERTO"
  const isEditing = editingShift === shift.id
  const canManageExpenses = userRole === "ADMIN" || userRole === "SOCIO"
  const canEditShift = canManageExpenses || isOpen
  const [editingExpense, setEditingExpense] = useState<string | null>(null)
  const [editExpenseValues, setEditExpenseValues] = useState<{ proveedor: string; importe: number }>({ proveedor: "", importe: 0 })
  const [openMobileMenu, setOpenMobileMenu] = useState(false)

  const efectivo = isEditing ? Number(editValues.efectivo) || 0 : Number(shift.efectivo)
  const caixa = isEditing ? Number(editValues.caixa) || 0 : Number(shift.caixa)
  const santander = isEditing ? Number(editValues.santander) || 0 : Number(shift.santander)
  const fondoInicial = Number(shift.fondoInicial)
  const totalExpenses = shift.expenses.reduce((sum, e) => sum + Number(e.importe), 0)
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
    setEditingShift(shift.id)
    setEditValues({ efectivo: String(efectivo), caixa: String(caixa), santander: String(santander) })
  }

  function cancelEditing() {
    setEditingShift(null)
  }

  function saveEditing() {
    onSave(shift.id, { efectivo: parseFloat(editValues.efectivo) || 0, caixa: parseFloat(editValues.caixa) || 0, santander: parseFloat(editValues.santander) || 0, fondoFinal: fondoInicial - totalExpenses })
  }

  async function handleEditExpense(expenseId: string) {
    await fetch(`/api/shifts/${shift.id}/expenses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId, proveedor: editExpenseValues.proveedor, importe: editExpenseValues.importe }),
    })
    setEditingExpense(null)
    window.location.reload()
  }

  async function handleDeleteExpense(expenseId: string) {
    await fetch(`/api/shifts/${shift.id}/expenses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId }),
    })
    window.location.reload()
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
                  <button onClick={() => setAddingExpenseTo(addingExpenseTo === shift.id ? null : shift.id)} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
                    {addingExpenseTo === shift.id ? "Cancelar" : "+ Gasto"}
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
                      <button onClick={() => { setAddingExpenseTo(addingExpenseTo === shift.id ? null : shift.id); setOpenMobileMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                        {addingExpenseTo === shift.id ? "Cancelar" : "+ Gasto"}
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
                      <span className="font-medium text-gray-900">{Number(expense.importe).toFixed(2)}</span>
                      {canManageExpenses && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingExpense(expense.id); setEditExpenseValues({ proveedor: expense.proveedor, importe: Number(expense.importe) }) }}
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

      {isOpen && addingExpenseTo === shift.id && (
        <form
          onSubmit={handleSubmit((data) => {
            onAddExpense(shift.id, data)
            reset()
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
