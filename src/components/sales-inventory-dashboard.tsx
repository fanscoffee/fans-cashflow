"use client"

import { useEffect, useState } from "react"
import { toN } from "@/lib/money"

interface SalesInventoryData {
  state?: "OK" | "INCOMPLETE"
  status?: "OK" | "INCOMPLETO"
  counts?: {
    current: { id: string; countedAt: string } | null
    previous: { id: string; countedAt: string } | null
  }
  conteos?: {
    actual: { id: string; countedAt: string } | null
    anterior: { id: string; countedAt: string } | null
  }
  summary?: {
    theoreticalSales: number
    actualSales: number
    variance: number | null
    variancePct: number | null
    shiftsWithClose: number
    shiftsWithoutClose: number
    productsValued: number
    pendingProducts: number
    inventoryAdjustments: number
  }
  resumen?: {
    theoreticalSales: number
    actualSales: number
    variance: number | null
    variancePct: number | null
    shiftsWithClose?: number
    shiftsConClose?: number
    shiftsWithoutClose: number
    productsValued?: number
    productsValorizados?: number
    pendingProducts?: number
    productsPendientes?: number
    inventoryAdjustments: number
  }
  warnings: string[]
}

function money(value: number | string | null) {
  return `${toN(value).toFixed(2)} €`
}

function Card({ label, value, tone = "text-gray-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

export default function SalesInventoryDashboard({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<SalesInventoryData | null>(null)
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
      ) : (() => {
        const state = data.state ?? (data.status === "INCOMPLETO" ? "INCOMPLETE" : "OK")
        const counts = data.counts ?? {
          current: data.conteos?.actual ?? null,
          previous: data.conteos?.anterior ?? null,
        }
        const summary = data.summary ?? {
          theoreticalSales: data.resumen?.theoreticalSales ?? 0,
          actualSales: data.resumen?.actualSales ?? 0,
          variance: data.resumen?.variance ?? null,
          variancePct: data.resumen?.variancePct ?? null,
          shiftsWithClose: data.resumen?.shiftsWithClose ?? data.resumen?.shiftsConClose ?? 0,
          shiftsWithoutClose: data.resumen?.shiftsWithoutClose ?? 0,
          productsValued: data.resumen?.productsValued ?? data.resumen?.productsValorizados ?? 0,
          pendingProducts: data.resumen?.pendingProducts ?? data.resumen?.productsPendientes ?? 0,
          inventoryAdjustments: data.resumen?.inventoryAdjustments ?? 0,
        }

        return (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card label="Venta teórica" value={money(summary.theoreticalSales)} />
            <Card label="Venta neta de caja" value={money(summary.actualSales)} />
            <Card
              label="Diferencia real - teórica"
              value={summary.variance == null ? "—" : money(summary.variance)}
              tone={summary.variance == null ? "text-gray-400" : summary.variance >= 0 ? "text-green-700" : "text-red-700"}
            />
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 text-sm min-[360px]:grid-cols-2 sm:grid-cols-4">
              <div>
                <span className="text-gray-500">Desviación</span>
                <p className="font-semibold text-gray-900">{summary.variancePct == null ? "—" : `${summary.variancePct.toFixed(2)}%`}</p>
              </div>
              <div>
                <span className="text-gray-500">Turnos con cierre</span>
                <p className="font-semibold text-gray-900">{summary.shiftsWithClose}</p>
              </div>
              <div>
                <span className="text-gray-500">Turnos sin ticket</span>
                <p className={`font-semibold ${summary.shiftsWithoutClose > 0 ? "text-amber-700" : "text-gray-900"}`}>{summary.shiftsWithoutClose}</p>
              </div>
              <div>
                <span className="text-gray-500">Productos valorados</span>
                <p className="font-semibold text-gray-900">{summary.productsValued}</p>
              </div>
              <div>
                <span className="text-gray-500">Conteos</span>
                <p className="break-words font-semibold text-gray-900 [overflow-wrap:anywhere]">
                  {counts.previous ? `${new Date(counts.previous.countedAt).toLocaleDateString("es-ES")} → ` : "— → "}
                  {counts.current ? new Date(counts.current.countedAt).toLocaleDateString("es-ES") : "—"}
                </p>
              </div>
            </div>
          </div>

          {state === "INCOMPLETE" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
          {state === "OK" && data.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </>
        )
      })()}
    </section>
  )
}
