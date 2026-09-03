"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

interface DashboardData {
  summary?: {
    totalShifts: number
    totalRevenue: number
    totalExpenses: number
    netProfit: number
  }
  resumen?: {
    totalShifts?: number
    totalTurnos?: number
    totalRevenue?: number
    totalIngresos?: number
    totalExpenses?: number
    totalGastos?: number
    netProfit?: number
    beneficioNeto?: number
  }
  dailyData: {
    day?: string
    revenue?: number
    expenses?: number
    morning?: number
    afternoon?: number
    dia?: string
    ingresos?: number
    gastos?: number
    mañana?: number
    tarde?: number
  }[]
  shiftData?: { name: string; value: number }[]
  turnoData?: { name: string; value: number }[]
  expenseData: { supplier?: string; proveedor?: string; total: number }[]
  exportData: Record<string, unknown>[]
  exportExpenses: Record<string, unknown>[]
}

import { downloadBlob, downloadCSV } from "@/lib/csv"
import { MONTH_NAMES } from "@/lib/constants"
import { toN } from "@/lib/money"
import SalesInventoryDashboard from "@/components/sales-inventory-dashboard"

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]

export default function Dashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportingAccounting, setExportingAccounting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const canExport = hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?month=${selectedMonth}&year=${selectedYear}`)
      if (res.ok) setData(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData()
  }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleExport() {
    if (!data?.exportData) return
    const filename = `fans-cashflow-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data.exportData, filename)
  }

  function handleExportExpenses() {
    if (!data?.exportExpenses) return
    const filename = `fans-cashflow-gastos-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data.exportExpenses, filename)
  }

  async function handleExportAccounting() {
    setExportingAccounting(true)
    setExportError(null)
    try {
      const response = await fetch(`/api/dashboard/export-gestoria?month=${selectedMonth}&year=${selectedYear}`)
      if (!response.ok) throw new Error("No se pudo generar la exportación")
      const blob = await response.blob()
      const filename = `fans-cashflow-gestoria-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.xlsx`
      downloadBlob(blob, filename)
    } catch {
      setExportError("No se pudo generar la exportación de gestoría")
    } finally {
      setExportingAccounting(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Cargando dashboard...</p>
  }

  if (!data) {
    return <p className="text-gray-500">No hay datos disponibles</p>
  }

  const summary = data.summary ?? {
    totalShifts: data.resumen?.totalShifts ?? data.resumen?.totalTurnos ?? 0,
    totalRevenue: data.resumen?.totalRevenue ?? data.resumen?.totalIngresos ?? 0,
    totalExpenses: data.resumen?.totalExpenses ?? data.resumen?.totalGastos ?? 0,
    netProfit: data.resumen?.netProfit ?? data.resumen?.beneficioNeto ?? 0,
  }
  const dailyData = data.dailyData.map((item) => ({
    day: item.day ?? item.dia ?? "",
    revenue: item.revenue ?? item.ingresos ?? 0,
    expenses: item.expenses ?? item.gastos ?? 0,
    morning: item.morning ?? item.mañana ?? 0,
    afternoon: item.afternoon ?? item.tarde ?? 0,
  }))
  const shiftData = data.shiftData ?? data.turnoData ?? []
  const expenseData = data.expenseData.map((item) => ({ supplier: item.supplier ?? item.proveedor ?? "", total: item.total }))

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto sm:py-1.5"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto sm:py-1.5"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {canExport && (
          <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:w-auto">
            <button
              onClick={handleExport}
              disabled={!data.exportData || data.exportData.length === 0}
              className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:py-1.5"
            >
              Exportar Turnos
            </button>
            <button
              onClick={handleExportExpenses}
              disabled={!data.exportExpenses || data.exportExpenses.length === 0}
              className="w-full rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 sm:w-auto sm:py-1.5"
            >
              Exportar Gastos
            </button>
            <button
              onClick={handleExportAccounting}
              disabled={exportingAccounting}
              className="w-full rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50 sm:w-auto sm:py-1.5"
            >
              {exportingAccounting ? "Preparando..." : "Exportar Gestoria"}
            </button>
          </div>
        )}
        {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-4">
        <Card label="Turnos" value={summary.totalShifts.toString()} />
        <Card label="Ingresos" value={`${summary.totalRevenue.toFixed(2)} €`} color="text-green-600" />
        <Card label="Gastos" value={`${summary.totalExpenses.toFixed(2)} €`} color="text-red-600" />
        <Card label="Beneficio Neto" value={`${summary.netProfit.toFixed(2)} €`} color={summary.netProfit >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      {hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER]) && (
        <SalesInventoryDashboard month={selectedMonth} year={selectedYear} />
      )}

      <div className="min-w-0 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos vs Gastos por día</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" fill="#3b82f6" name="Ingresos" />
            <Bar dataKey="expenses" fill="#ef4444" name="Gastos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos por turno</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={shiftData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {shiftData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${toN(value).toFixed(2)} €`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos mañana vs tarde</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="morning" fill="#3b82f6" name="Mañana" />
              <Bar dataKey="afternoon" fill="#f59e0b" name="Tarde" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {expenseData.length > 0 && (
        <div className="min-w-0 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Gastos por proveedor</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm sm:min-w-0">
              <thead>
                <tr className="border-b text-xs font-medium text-gray-500">
                  <th className="pb-2">Proveedor</th>
                  <th className="pb-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenseData.map((e) => (
                  <tr key={e.supplier}>
                    <td className="break-words py-2 text-gray-900 [overflow-wrap:anywhere]">{e.supplier}</td>
                    <td className="py-2 text-right font-medium text-red-600">{e.total.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-lg font-bold sm:text-xl ${color || "text-gray-900"}`}>
        {value}
      </p>
    </div>
  )
}
