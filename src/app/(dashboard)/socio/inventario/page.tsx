"use client"

import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import InventoryPage from "@/components/inventory/inventory-page"
import { canDeleteInventoryItems } from "@/lib/inventory-permissions"

export default function PartnerInventoryPage() {
  const { data: session, status } = useSession()

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
        subtitle={`Inventario — ${session?.user?.name || session?.user?.email}`}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:pb-6">
         <InventoryPage canDeleteProductsAndSuppliers={canDeleteInventoryItems(session?.user)} />
      </main>
    </div>
  )
}
