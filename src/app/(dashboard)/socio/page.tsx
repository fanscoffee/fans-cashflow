"use client"

import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import Dashboard from "@/components/dashboard"
import PasskeyManager from "@/components/passkey-manager"

export default function SocioPage() {
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
        subtitle={`Socio — ${session?.user?.name || session?.user?.email}`}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <Dashboard />
        <PasskeyManager />
      </main>
    </div>
  )
}
