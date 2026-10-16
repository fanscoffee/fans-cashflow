"use client"

import { useEffect, useState } from "react"
import { downloadCSV } from "@/lib/csv"

interface ShiftTicket {
  id: string
  date: string
  ticketNumber: string
  cash: number
  card: number
  vat4Base: number
  vat4: number
  vat10Base: number
  vat10: number
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function periodParts(value: string) {
  const [year, month] = value.split("-").map(Number)
  return { year, month }
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("es-ES")
}

function formatMoney(value: number) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function csvMoney(value: number) {
  return value.toFixed(2)
}

export default function ShiftTicketsPanel() {
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth)
  const [tickets, setTickets] = useState<ShiftTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const { year, month } = periodParts(selectedPeriod)

    async function loadTickets() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/gestoria/tickets?month=${month}&year=${year}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "No se pudieron cargar los tickets")
        if (!cancelled) setTickets(result.tickets || [])
      } catch (reason) {
        if (!cancelled) {
          setTickets([])
          setError(reason instanceof Error ? reason.message : "No se pudieron cargar los tickets")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTickets()
    return () => { cancelled = true }
  }, [selectedPeriod])

  function exportTickets() {
    const { year, month } = periodParts(selectedPeriod)
    const rows = tickets.map((ticket) => ({
      Ticket: ticket.ticketNumber,
      Fecha: formatDate(ticket.date),
      Efectivo: csvMoney(ticket.cash),
      Tarjeta: csvMoney(ticket.card),
      "Base IVA 4%": csvMoney(ticket.vat4Base),
      "IVA 4%": csvMoney(ticket.vat4),
      "Base IVA 10%": csvMoney(ticket.vat10Base),
      "IVA 10%": csvMoney(ticket.vat10),
    }))
    downloadCSV(rows, `fans-cashflow-turnos-${year}-${String(month).padStart(2, "0")}.csv`)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tickets de cierre por mes</h2>
            <p className="text-xs text-gray-500">Datos recuperados al cerrar cada turno.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-xs text-gray-600">
              <span className="mb-1 block font-medium">Mes</span>
              <input
                aria-label="Mes de consulta"
                type="month"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={exportTickets}
              disabled={tickets.length === 0}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
          No hay cierres con ticket para este mes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm text-gray-900">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-3 py-3">Ticket</th>
                <th scope="col" className="px-3 py-3">Fecha</th>
                <th scope="col" className="px-3 py-3 text-right">Efectivo</th>
                <th scope="col" className="px-3 py-3 text-right">Tarjeta</th>
                <th scope="col" className="px-3 py-3 text-right">Base IVA 4%</th>
                <th scope="col" className="px-3 py-3 text-right">IVA 4%</th>
                <th scope="col" className="px-3 py-3 text-right">Base IVA 10%</th>
                <th scope="col" className="px-3 py-3 text-right">IVA 10%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 font-medium">{ticket.ticketNumber}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(ticket.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.cash)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.card)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.vat4Base)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.vat4)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.vat10Base)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(ticket.vat10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
