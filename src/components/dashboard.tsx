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

interface DashboardData {
  resumen: {
    totalTurnos: number
    totalIngresos: number
    totalGastos: number
    beneficioNeto: number
  }
  dailyData: {
    dia: string
    ingresos: number
    gastos: number
    mañana: number
    tarde: number
  }[]
  turnoData: { name: string; value: number }[]
  expenseData: { proveedor: string; total: number }[]
  exportData: {
    fecha: string
    turno: string
    estado: string
    creadoPor: string
    fondoInicial: number
    efectivo: number
    caixa: number
    santander: number
    efectivoGasto: number
    fondoFinal: number
    totalGastos: number
    gastos: string
  }[]
  exportExpenses: {
    fecha: string
    turno: string
    proveedor: string
    importe: number
    creadoPor: string
  }[]
}

import { downloadCSV } from "@/lib/csv"
import { MONTH_NAMES } from "@/lib/constants"
import { toN } from "@/lib/money"

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]

export default function Dashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const canExport = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"

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

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  if (loading) {
    return <p className="text-gray-500">Cargando dashboard...</p>
  }

  if (!data) {
    return <p className="text-gray-500">No hay datos disponibles</p>
  }

  const { resumen, dailyData, turnoData, expenseData } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </div>
        {canExport && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={!data.exportData || data.exportData.length === 0}
              className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Exportar Turnos
            </button>
            <button
              onClick={handleExportExpenses}
              disabled={!data.exportExpenses || data.exportExpenses.length === 0}
              className="rounded-md bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              Exportar Gastos
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Turnos" value={resumen.totalTurnos.toString()} />
        <Card label="Ingresos" value={`${resumen.totalIngresos.toFixed(2)} €`} color="text-green-600" />
        <Card label="Gastos" value={`${resumen.totalGastos.toFixed(2)} €`} color="text-red-600" />
        <Card label="Beneficio Neto" value={`${resumen.beneficioNeto.toFixed(2)} €`} color={resumen.beneficioNeto >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos vs Gastos por día</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="ingresos" fill="#3b82f6" name="Ingresos" />
            <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos por turno</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={turnoData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {turnoData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${toN(value).toFixed(2)} €`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Ingresos mañana vs tarde</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="mañana" fill="#3b82f6" name="Mañana" />
              <Bar dataKey="tarde" fill="#f59e0b" name="Tarde" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {expenseData.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Gastos por proveedor</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-medium text-gray-500">
                  <th className="pb-2">Proveedor</th>
                  <th className="pb-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenseData.map((e) => (
                  <tr key={e.proveedor}>
                    <td className="py-2 text-gray-900">{e.proveedor}</td>
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
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color || "text-gray-900"}`}>{value}</p>
    </div>
  )
}
