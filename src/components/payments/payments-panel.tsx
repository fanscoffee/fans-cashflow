"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useSession } from "next-auth/react"
import { PaymentEntity, PaymentMethodType, parsePaymentEntity, parsePaymentMethodType } from "@/lib/database-enums"

type Entity = "BAKERY" | "COFFEE_SHOP"

function entityLabel(entity: string) {
  const normalized = parsePaymentEntity(entity)
  if (normalized === PaymentEntity.BAKERY) return "Obrador"
  if (normalized === PaymentEntity.COFFEE_SHOP) return "Cafetería"
  return entity
}

function paymentMethodLabel(type: string) {
  const normalized = parsePaymentMethodType(type)
  if (normalized === PaymentMethodType.BANK_TRANSFER || normalized === PaymentMethodType.DIRECT_DEBIT) return "Banco"
  if (normalized === PaymentMethodType.CASH) return "Efectivo"
  if (normalized === PaymentMethodType.CARD) return "Tarjeta"
  if (normalized === PaymentMethodType.CHECK) return "Cheque"
  if (normalized === PaymentMethodType.MOBILE_PAYMENT) return "Pago móvil"
  return type
}

interface Config {
  categories: Array<{ id: string; code: string; name: string }>
  creditors: Array<{ id: string; code: string; name: string; type: string; defaultEntity: Entity | null }>
  accounts: Array<{ id: string; type: string; entity: Entity; description: string; theoreticalBalance: string | number; fixedFloat: string | number | null }>
  paymentMethods: Array<{ id: string; type: string; transactionLimit: string | number | null }>
}

interface DocumentItem {
  id: string
  number?: string
  entity: Entity
  creditorId: string | null
  creditor: { id: string; name: string } | null
  confirmedAmount?: string | number | null
  amount?: string | number
  withheldAmount?: string | number | null
  dueDate?: string | null
  accrualDate?: string
  concept?: string
  status?: string
  workflowStatus?: string
  applications: Array<{ appliedAmount: string | number }>
  category?: { code: string; name: string }
  requester?: { id: string; name: string | null; email: string } | null
}

interface Dashboard {
  invoices: DocumentItem[]
  expenses: DocumentItem[]
  pendingExpenses: DocumentItem[]
  payments: Array<{ id: string; number: number; totalAmount: string | number; status: string; creditor: { name: string }; fundsAccount: { description: string }; paymentMethod: { type: string } }>
  cashAccounts: Config["accounts"]
  methods: Config["paymentMethods"]
}

interface SelectedDocument {
  destinationType: "INVOICE" | "EXPENSE"
  id: string
  entity: Entity
  creditorId: string
  creditorName: string
  pending: number
  label: string
}

function amount(value: string | number | null | undefined) {
  return Number(value || 0)
}

function euros(value: string | number | null | undefined) {
  return `${amount(value).toFixed(2)} €`
}

function pending(document: DocumentItem) {
  const total = amount(document.confirmedAmount ?? document.amount)
  const applied = document.applications.reduce((sum, application) => sum + amount(application.appliedAmount), 0)
  return Math.max(0, total - applied)
}

export default function PaymentsPanel() {
  const { data: session } = useSession()
  const [entity, setEntity] = useState<Entity>("BAKERY")
  const [config, setConfig] = useState<Config | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [selected, setSelected] = useState<SelectedDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [payment, setPayment] = useState({ methodId: "", accountId: "", date: new Date().toISOString().slice(0, 10), amount: "" })

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [configResponse, dashboardResponse] = await Promise.all([
        fetch(`/api/pagos/configuracion?entity=${entity}`),
        fetch(`/api/pagos?entity=${entity}`),
      ])
      const [nextConfig, nextDashboard] = await Promise.all([configResponse.json(), dashboardResponse.json()])
      if (!configResponse.ok) throw new Error(nextConfig.error || "No se pudo cargar la configuración")
      if (!dashboardResponse.ok) throw new Error(nextDashboard.error || "No se pudo cargar pagos")
      setConfig(nextConfig)
      setDashboard(nextDashboard)
      setPayment((current) => ({ ...current, methodId: current.methodId || nextConfig.paymentMethods[0]?.id || "", accountId: current.accountId || nextConfig.accounts[0]?.id || "" }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error al cargar el módulo")
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => { void load() }, [entity])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const invoiceDocuments = useMemo(() => (dashboard?.invoices || []).map((invoice) => ({
    destinationType: "INVOICE" as const,
    id: invoice.id,
    entity: invoice.entity,
    creditorId: invoice.creditorId || "",
    creditorName: invoice.creditor?.name || "Sin acreedor",
    pending: pending(invoice),
    label: `Factura ${invoice.number || invoice.id}`,
  })).filter((item) => item.creditorId && item.pending > 0), [dashboard])

  const expenseDocuments = useMemo(() => (dashboard?.expenses || []).map((expenseItem) => ({
    destinationType: "EXPENSE" as const,
    id: expenseItem.id,
    entity: expenseItem.entity,
    creditorId: expenseItem.creditorId || "",
    creditorName: expenseItem.creditor?.name || "Sin acreedor",
    pending: pending(expenseItem),
    label: expenseItem.concept || `Gasto ${expenseItem.id}`,
  })).filter((item) => item.creditorId && item.pending > 0), [dashboard])

  const availableAccounts = (config?.accounts || []).filter((account) => account.entity === entity)

  function selectDocument(document: SelectedDocument) {
    setSelected(document)
    setPayment((current) => ({ ...current, amount: document.pending.toFixed(2), accountId: availableAccounts[0]?.id || current.accountId }))
    setError("")
  }

  async function authorizeExpense(id: string, approve: boolean) {
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(`/api/pagos/gastos/${id}/autorizar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authorizerId: session?.user?.id, approve, rejectionReason: approve ? undefined : "Revisar justificante y concepto" }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la autorización")
      setSuccess(approve ? "Gasto autorizado" : "Gasto rechazado")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la autorización")
    } finally { setSaving(false) }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/pagos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: entity, paymentDate: payment.date, paymentMethodId: payment.methodId, fundsAccountId: payment.accountId, creditorId: selected.creditorId, applications: [{ destinationType: selected.destinationType, destinationId: selected.id, appliedAmount: Number(payment.amount) }] }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el pago")
      setSuccess(`Pago ${entityLabel(entity)}-${result.number} registrado correctamente`)
      setSelected(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el pago")
    } finally { setSaving(false) }
  }

  if (loading && !dashboard) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Cargando módulo de pagos...</div>

  return (
    <div className="payments-panel min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">Salidas documentadas, autorizadas y conciliables</p>
          <p className="text-xs text-gray-400">Los umbrales se administran como parámetros, no desde el navegador.</p>
        </div>
        <label className="flex items-center justify-between gap-2 text-sm text-gray-600 sm:block">Entidad <select value={entity} onChange={(event) => setEntity(event.target.value as Entity)} className="rounded-md border px-3 py-2 text-sm text-gray-900 sm:ml-2"><option value={PaymentEntity.BAKERY}>Obrador</option><option value={PaymentEntity.COFFEE_SHOP}>Cafetería</option></select></label>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>}

      {(!config || config.accounts.length === 0 || config.paymentMethods.length === 0) && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Configuración pendiente.</strong> Antes del primer pago debe existir al menos una cuenta de fondos activa y un medio de pago. Los endpoints de configuración están disponibles para administración.</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Facturas pagables</p><p className="mt-1 text-2xl font-semibold text-gray-900">{invoiceDocuments.length}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Gastos autorizados</p><p className="mt-1 text-2xl font-semibold text-gray-900">{expenseDocuments.length}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Pagos recientes</p><p className="mt-1 text-2xl font-semibold text-gray-900">{dashboard?.payments.length || 0}</p></div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-lg font-semibold text-gray-900">Documentos pagables</h2><p className="text-xs text-gray-500">Solo aparecen documentos conformados o gastos autorizados.</p></div><span className="shrink-0 text-xs text-gray-500">{invoiceDocuments.length + expenseDocuments.length} pendientes</span></div>
        <div className="overflow-x-auto [scrollbar-width:thin]"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-gray-700"><tr><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Documento</th><th className="px-2 py-2">Acreedor</th><th className="px-2 py-2 text-right">Pendiente</th><th className="px-2 py-2">Acción</th></tr></thead><tbody className="divide-y">{[...invoiceDocuments, ...expenseDocuments].map((document) => <tr key={`${document.destinationType}-${document.id}`}><td className="px-2 py-3 text-xs text-gray-500">{document.destinationType === "INVOICE" ? "Factura" : "Gasto"}</td><td className="break-words px-2 py-3 font-medium text-gray-900 [overflow-wrap:anywhere]">{document.label}</td><td className="break-words px-2 py-3 font-medium text-gray-900 [overflow-wrap:anywhere]">{document.creditorName}</td><td className="px-2 py-3 text-right font-semibold text-gray-900">{euros(document.pending)}</td><td className="px-2 py-3"><button type="button" onClick={() => selectDocument(document)} className="min-h-11 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 sm:min-h-0">Pagar</button></td></tr>)}</tbody></table>{invoiceDocuments.length + expenseDocuments.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay documentos pendientes de pago.</p>}</div>
      </section>

      {selected && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-blue-950">Registrar pago</h2><p className="text-sm text-blue-900">{selected.label} · {selected.creditorName}</p><p className="text-xs text-blue-800">El importe total se calcula a partir de las aplicaciones.</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs text-gray-700">Cancelar</button></div><form onSubmit={submitPayment} className="grid gap-3 sm:grid-cols-4"><label className="text-xs text-gray-700">Fecha<input type="date" value={payment.date} onChange={(event) => setPayment({ ...payment, date: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><label className="text-xs text-gray-700">Medio<select value={payment.methodId} onChange={(event) => setPayment({ ...payment, methodId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar...</option>{(config?.paymentMethods || []).map((method) => <option key={method.id} value={method.id}>{paymentMethodLabel(method.type)}{method.transactionLimit ? ` · máx. ${euros(method.transactionLimit)}` : ""}</option>)}</select></label><label className="text-xs text-gray-700">Cuenta de origen<select value={payment.accountId} onChange={(event) => setPayment({ ...payment, accountId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar...</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.description} · saldo {euros(account.theoreticalBalance)}</option>)}</select></label><label className="text-xs text-gray-700">Aplicar<input type="number" min="0.01" max={selected.pending} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><div className="sm:col-span-4"><button type="submit" disabled={saving || !config?.accounts.length || !config?.paymentMethods.length} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">{saving ? "Registrando..." : "Confirmar salida"}</button></div></form></section>}

      {(dashboard?.pendingExpenses || []).length > 0 && <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-3 break-words text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">Autorizaciones pendientes · gastos de turnos</h2><div className="space-y-2">{dashboard?.pendingExpenses.map((expenseItem) => <div key={expenseItem.id} className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium text-gray-900 [overflow-wrap:anywhere]">{expenseItem.concept}</p><p className="break-words text-xs text-gray-500 [overflow-wrap:anywhere]">{entityLabel(expenseItem.entity)} · {expenseItem.category?.name} · {euros(expenseItem.amount)} · solicitado por {expenseItem.requester?.name || expenseItem.requester?.email || "Usuario desconocido"}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" disabled={saving} onClick={() => void authorizeExpense(expenseItem.id, true)} className="min-h-11 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 sm:min-h-0">Autorizar</button><button type="button" disabled={saving} onClick={() => void authorizeExpense(expenseItem.id, false)} className="min-h-11 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50 sm:min-h-0">Rechazar</button></div></div>)}</div></section>}
    </div>
  )
}
