"use client"

import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import FacturasPanel from "@/components/inventario/facturas-panel"
import GastosCorrientesTracking from "@/components/inventario/gastos-corrientes-tracking"

export default function AdminFacturasPage() {
  const { data: session, status } = useSession()
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-gray-50"><p className="text-gray-500">Cargando...</p></div>
  return <div className="facturas-page min-h-screen bg-gray-50"><AppHeader title="Fans Cashflow" subtitle={`Facturas — ${session?.user?.name || session?.user?.email || ""}`} /><main className="mx-auto max-w-6xl space-y-4 px-4 py-6"><FacturasPanel /><GastosCorrientesTracking canAccess={session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"} /></main></div>
}
