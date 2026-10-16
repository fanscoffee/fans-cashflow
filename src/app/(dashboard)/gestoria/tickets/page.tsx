"use client"

import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import ShiftTicketsPanel from "@/components/accounting/shift-tickets-panel"

export default function ShiftTicketsPage() {
  const { data: session, status } = useSession()
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-gray-50"><p className="text-gray-500">Cargando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle={`Gestoría — ${session?.user?.name || session?.user?.email || ""}`} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 pb-24 sm:pb-6">
        <ShiftTicketsPanel />
      </main>
    </div>
  )
}
