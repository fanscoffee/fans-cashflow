"use client"

import { useEffect, useState } from "react"
import { toN } from "@/lib/money"

interface VentaInventarioData {
  estado: "OK" | "INCOMPLETO"
  conteos: {
    actual: { id: string; fechaConteo: string } | null
    anterior: { id: string; fechaConteo: string } | null
  }
  resumen: {
    ventaTeorica: number
    ventaReal: number
    diferencia: number | null
    diferenciaPct: number | null
    turnosConCierre: number
    turnosSinCierre: number
    productosValorizados: number
    productosPendientes: number
    ajustesInventario: number
  }
  advertencias: string[]
}

function money(value: number | string | null) {
  return `${toN(value).toFixed(2)} €`
}

function Card({ label, value, tone = "text-gray-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

export default function VentaInventarioDashboard({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<VentaInventarioData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/dashboard/venta-inventario?month=${month}&year=${year}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [month, year])

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Venta teórica vs. venta de caja</h2>
        <p className="text-sm text-gray-500">Comparación mensual basada en conteos físicos y cierres de turno confirmados.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando valoración de inventario...</p>
      ) : !data ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No se pudo cargar la valoración mensual.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card label="Venta teórica" value={money(data.resumen.ventaTeorica)} />
            <Card label="Venta neta de caja" value={money(data.resumen.ventaReal)} />
            <Card
              label="Diferencia real - teórica"
              value={data.resumen.diferencia == null ? "—" : money(data.resumen.diferencia)}
              tone={data.resumen.diferencia == null ? "text-gray-400" : data.resumen.diferencia >= 0 ? "text-green-700" : "text-red-700"}
            />
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <span className="text-gray-500">Desviación</span>
                <p className="font-semibold text-gray-900">{data.resumen.diferenciaPct == null ? "—" : `${data.resumen.diferenciaPct.toFixed(2)}%`}</p>
              </div>
              <div>
                <span className="text-gray-500">Turnos con cierre</span>
                <p className="font-semibold text-gray-900">{data.resumen.turnosConCierre}</p>
              </div>
              <div>
                <span className="text-gray-500">Turnos sin ticket</span>
                <p className={`font-semibold ${data.resumen.turnosSinCierre > 0 ? "text-amber-700" : "text-gray-900"}`}>{data.resumen.turnosSinCierre}</p>
              </div>
              <div>
                <span className="text-gray-500">Productos valorados</span>
                <p className="font-semibold text-gray-900">{data.resumen.productosValorizados}</p>
              </div>
              <div>
                <span className="text-gray-500">Conteos</span>
                <p className="font-semibold text-gray-900">
                  {data.conteos.anterior ? `${new Date(data.conteos.anterior.fechaConteo).toLocaleDateString("es-ES")} → ` : "— → "}
                  {data.conteos.actual ? new Date(data.conteos.actual.fechaConteo).toLocaleDateString("es-ES") : "—"}
                </p>
              </div>
            </div>
          </div>

          {data.estado === "INCOMPLETO" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {data.advertencias.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
          {data.estado === "OK" && data.advertencias.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {data.advertencias.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </>
      )}
    </section>
  )
}
