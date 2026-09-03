import AppHeader from "@/components/app-header"
import ReceiptsPanel from "@/components/inventory/receipts-panel"

export default function EmployeeReceiptsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle="Recepción de mercancía" />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 pb-24 sm:pb-6">
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 sm:p-5">
          <h2 className="font-semibold">Registrar una entrega</h2>
          <p className="mt-1">
            Ten el albarán delante, cuenta los productos que llegan y registra la cantidad realmente recibida.
            El registro quedará asociado a tu usuario.
          </p>
        </section>

        <ReceiptsPanel canDelete={false} initialView="create" />
      </main>
    </div>
  )
}
