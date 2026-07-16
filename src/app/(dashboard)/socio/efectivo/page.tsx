"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"

interface CashTracking {
  id: string
  destination: string
  createdBy?: { name: string | null; email: string }
}

interface Shift {
  id: string
  date: string
  turno: string
  status: string
  efectivo: number
  cashTracking: CashTracking | null
  createdBy?: { name: string | null; email: string }
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const DESTINATION_LABELS: Record<string, string> = {
  DEPOSITO: "Depósito",
  INGRESO_EN_FONDO: "Ingreso en fondo",
  GUARDADO: "Guardado",
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h as keyof typeof row]
          const str = String(val ?? "")
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(",")
    ),
  ]
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function EfectivoPage() {
  const { data: session, status } = useSession()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/cash-tracking?month=${selectedMonth}&year=${selectedYear}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setShifts(data)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [status, selectedMonth, selectedYear])

  async function handleDestinationChange(shiftId: string, destination: string) {
    setSaving(shiftId)
    try {
      const res = await fetch("/api/cash-tracking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, destination }),
      })
      if (res.ok) {
        const updated = await res.json()
        setShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId
              ? { ...s, cashTracking: { id: updated.id, destination: updated.destination, createdBy: { name: session?.user?.name || null, email: session?.user?.email || "" } } }
              : s
          )
        )
      }
    } catch {
      // ignore
    } finally {
      setSaving(null)
    }
  }

  function handleExport() {
    const data = shifts.map((s) => ({
      Fecha: new Date(s.date).toLocaleDateString("es-ES"),
      Turno: s.turno,
      Efectivo: Number(s.efectivo).toFixed(2),
      Destino: s.cashTracking ? DESTINATION_LABELS[s.cashTracking.destination] || s.cashTracking.destination : "Sin asignar",
      AsignadoPor: s.cashTracking?.createdBy?.name || s.cashTracking?.createdBy?.email || "",
      CreadoPor: s.createdBy?.name || s.createdBy?.email || "",
    }))
    const filename = `efectivo-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data, filename)
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle="Tracking de Efectivo" />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Efectivo por Turno</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                disabled={shifts.length === 0}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Exportar
              </button>
            </div>
          </div>

          {shifts.length === 0 ? (
            <p className="text-sm text-gray-500">No hay turnos para este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium text-gray-500">
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2">Turno</th>
                    <th className="pb-2 text-right">Efectivo</th>
                    <th className="pb-2 text-center">Depósito</th>
                    <th className="pb-2 text-center">Ingreso en fondo</th>
                    <th className="pb-2 text-center">Guardado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-900">
                        {new Date(shift.date).toLocaleDateString("es-ES")}
                      </td>
                      <td className="py-3 text-gray-900">{shift.turno}</td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {Number(shift.efectivo).toFixed(2)} €
                      </td>
                      {(["DEPOSITO", "INGRESO_EN_FONDO", "GUARDADO"] as const).map((dest) => (
                        <td key={dest} className="py-3 text-center">
                          <input
                            type="radio"
                            name={`dest-${shift.id}`}
                            checked={shift.cashTracking?.destination === dest}
                            disabled={saving === shift.id}
                            onChange={() => handleDestinationChange(shift.id, dest)}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
