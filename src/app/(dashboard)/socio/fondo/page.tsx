"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import AppHeader from "@/components/app-header"

const fundSchema = z.object({
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  description: z.string().optional(),
})

type FundFormData = z.infer<typeof fundSchema>

interface FundAddition {
  id: string
  amount: number
  description: string | null
  createdAt: string
  createdBy: { name: string | null; email: string }
}

const PAGE_SIZE = 10

export default function FondoPage() {
  const { status } = useSession()
  const [additions, setAdditions] = useState<FundAddition[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [fondo, setFondo] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchText, setSearchText] = useState("")
  const [page, setPage] = useState(1)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FundFormData>({
    resolver: zodResolver(fundSchema),
    defaultValues: { amount: 0, description: "" },
  })

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false
    Promise.all([
      fetch("/api/fund-additions").then((r) => r.json()),
      fetch("/api/fund").then((r) => r.json()),
    ]).then(([additionsData, fundData]) => {
      if (!cancelled) {
        setAdditions(additionsData)
        setFondo(fundData.fondo)
        setLoadingData(false)
      }
    }).catch(() => { if (!cancelled) setLoadingData(false) })
    return () => { cancelled = true }
  }, [status])

  const filtered = useMemo(() => {
    const lowerSearch = searchText.toLowerCase()
    return additions.filter((a) => {
      const dateStr = a.createdAt.slice(0, 10)
      if (dateFrom && dateStr < dateFrom) return false
      if (dateTo && dateStr > dateTo) return false
      if (lowerSearch) {
        const desc = (a.description || "").toLowerCase()
        const creator = (a.createdBy.name || a.createdBy.email || "").toLowerCase()
        if (!desc.includes(lowerSearch) && !creator.includes(lowerSearch)) return false
      }
      return true
    })
  }, [additions, dateFrom, dateTo, searchText])

  const visibleCount = page * PAGE_SIZE
  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const resetFilters = () => {
    setDateFrom("")
    setDateTo("")
    setSearchText("")
    setPage(1)
  }

  async function onSubmitFund(data: FundFormData) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/fund-additions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al registrar el depósito")
        return
      }

      setSuccess("Depósito registrado correctamente")
      reset()
      const [addRes, fundRes] = await Promise.all([
        fetch("/api/fund-additions"),
        fetch("/api/fund"),
      ])
      if (addRes.ok) setAdditions(await addRes.json())
      if (fundRes.ok) setFondo((await fundRes.json()).fondo)
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Fans Cashflow"
        subtitle="Gestión del Fondo"
      />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
        )}

        <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Depósito al Fondo</h2>
          <form onSubmit={handleSubmit(onSubmitFund)} className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-4">
            <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 sm:hidden">
              <span className="text-xs text-gray-600">Fondo:</span>
              <span className="text-sm font-bold text-blue-700">
                {fondo !== null ? `${fondo.toFixed(2)} €` : "..."}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Monto</label>
              <input
                type="number"
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
              )}
            </div>
            <div className="col-span-2 min-w-0 flex-1 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Descripción</label>
              <input
                type="text"
                {...register("description")}
                placeholder="Opcional..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="hidden items-center gap-2 rounded-md bg-blue-50 px-3 py-2 sm:flex">
              <span className="text-xs text-gray-600">Fondo:</span>
              <span className="text-sm font-bold text-blue-700">
                {fondo !== null ? `${fondo.toFixed(2)} €` : "..."}
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="col-span-2 w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 sm:col-span-1 sm:w-auto sm:px-6"
            >
              {isSubmitting ? "Guardando..." : "Depositar"}
            </button>
          </form>
        </section>

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historial de Depósitos</h2>

          {/* Filters */}
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="min-w-0 sm:min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600">Buscar</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
                  placeholder="Descripción o persona..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={resetFilters}
                className="col-span-2 w-full rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 sm:col-span-1 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          {loadingData ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">
              {additions.length === 0 ? "No hay depósitos registrados." : "No hay depósitos que coincidan con los filtros."}
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">Mostrando {visible.length} de {filtered.length} depósitos</p>
              <div className="space-y-2">
                {visible.map((addition) => (
                  <div key={addition.id} className="flex items-center justify-between rounded-md border border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        + {Number(addition.amount).toFixed(2)} €
                      </p>
                      {addition.description && (
                        <p className="text-xs text-gray-500">{addition.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {addition.createdBy.name || addition.createdBy.email}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(addition.createdAt).toLocaleDateString("es-ES")} {new Date(addition.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="mt-4 w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Mostrar más ({filtered.length - visibleCount} restantes)
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
