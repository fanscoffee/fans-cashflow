"use client"

import { useState, useEffect } from "react"
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
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/dashboard")
        if (res.ok && !cancelled) setData(await res.json())
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <p className="text-gray-500">Cargando dashboard...</p>
  }

  if (!data) {
    return <p className="text-gray-500">No hay datos disponibles</p>
  }

  const { resumen, dailyData, turnoData, expenseData } = data

  return (
    <div className="space-y-6">
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
              <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(2)} €`} />
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
