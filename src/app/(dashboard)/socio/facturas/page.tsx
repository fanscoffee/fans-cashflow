"use client"

import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import InvoicesPanel from "@/components/inventory/invoices-panel"
import CurrentExpensesTracking from "@/components/inventory/current-expenses-tracking"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export default function PartnerInvoicesPage() {
  const { data: session, status } = useSession()
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-gray-50"><p className="text-gray-500">Cargando...</p></div>
  return <div className="facturas-page min-h-screen bg-gray-50"><AppHeader title="Fans Cashflow" subtitle={`Facturas — ${session?.user?.name || session?.user?.email || ""}`} /><main className="mx-auto max-w-6xl space-y-4 px-4 py-6 pb-24 sm:pb-6"><InvoicesPanel /><CurrentExpensesTracking canAccess={hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])} /></main></div>
}
