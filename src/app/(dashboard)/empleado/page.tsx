"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import PasskeyManager from "@/components/passkey-manager"
import { OpenShiftForm } from "@/components/open-shift-form"
import { ShiftCard } from "@/components/shift-card"
import { useAutoLogout } from "@/hooks/useAutoLogout"
import type { Shift, ShiftFormData } from "@/types/shift"

export default function EmpleadoPage() {
  const { data: session, status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [closingShift, setClosingShift] = useState<string | null>(null)
  const [fondoInicial, setFondoInicial] = useState<number | null>(null)
  const [dateStr, setDateStr] = useState("")

  useAutoLogout(session?.user?.role === "EMPLEADO")

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0])
  }, [])

  const refreshData = useCallback(async () => {
    const [shiftsRes, fundRes] = await Promise.all([
      fetch("/api/shifts"),
      fetch("/api/fund"),
    ])
    if (shiftsRes.ok) {
      const data = await shiftsRes.json()
      setShifts(data)
    }
    if (fundRes.ok) {
      const fundData = await fundRes.json()
      setFondoInicial(fundData.fondo)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [shiftsRes, fundRes] = await Promise.all([
          fetch("/api/shifts"),
          fetch("/api/fund"),
        ])
        if (shiftsRes.ok && !cancelled) {
          const data = await shiftsRes.json()
          setShifts(data)
        }
        if (fundRes.ok && !cancelled) {
          const fundData = await fundRes.json()
          setFondoInicial(fundData.fondo)
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

  async function onSubmitShift(data: ShiftFormData) {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, date: dateStr }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al crear el turno")
        return
      }
      setSuccess("Turno abierto correctamente")
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

  if (status === "loading" || loading || fondoInicial === null) {
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
          <OpenShiftForm
            fondoInicial={fondoInicial}
            hasOpenShift={hasOpenShift}
            dateStr={dateStr}
            userRole={session?.user?.role}
            onSubmit={onSubmitShift}
          />
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
                  onSave={handleSaveShift}
                  onClose={handleCloseShift}
                  onReopen={handleReopenShift}
                  closingShift={closingShift}
                  onRefresh={refreshData}
                />
              ))}
            </div>
          )}
        </section>

        {!isReadOnly && <PasskeyManager />}
      </main>
    </div>
  )
}
