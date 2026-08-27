"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useSession } from "next-auth/react"

type Entity = "OBRADOR" | "CAFETERIA"

interface Config {
  categorias: Array<{ id: string; codigo: string; nombre: string }>
  acreedores: Array<{ id: string; codigo: string; nombre: string; tipo: string; entidadHabitual: Entity | null }>
  cuentas: Array<{ id: string; tipo: string; entidad: Entity; descripcion: string; saldoTeorico: string | number; fondoFijo: string | number | null }>
  medios: Array<{ id: string; tipo: string; limiteOperacion: string | number | null }>
}

interface DocumentItem {
  id: string
  numero?: string
  entidad: Entity
  acreedorId: string | null
  acreedor: { id: string; nombre: string } | null
  importeConformado?: string | number | null
  importe?: string | number
  importeRetenido?: string | number | null
  fechaVencimiento?: string | null
  fechaDevengo?: string
  concepto?: string
  estado?: string
  estadoCircuito?: string
  aplicaciones: Array<{ importeAplicado: string | number }>
  categoria?: { codigo: string; nombre: string }
}

interface Dashboard {
  invoices: DocumentItem[]
  expenses: DocumentItem[]
  payments: Array<{ id: string; numero: number; importeTotal: string | number; estado: string; acreedor: { nombre: string }; cuentaFondos: { descripcion: string }; medioPago: { tipo: string } }>
  cashAccounts: Config["cuentas"]
  methods: Config["medios"]
}

interface SelectedDocument {
  tipoDestino: "FACTURA" | "GASTO"
  id: string
  entidad: Entity
  acreedorId: string
  acreedorNombre: string
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
  const total = amount(document.importeConformado ?? document.importe)
  const applied = document.aplicaciones.reduce((sum, application) => sum + amount(application.importeAplicado), 0)
  return Math.max(0, total - applied)
}

export default function PagosPanel() {
  const { data: session } = useSession()
  const [entity, setEntity] = useState<Entity>("OBRADOR")
  const [config, setConfig] = useState<Config | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [selected, setSelected] = useState<SelectedDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [payment, setPayment] = useState({ methodId: "", accountId: "", date: new Date().toISOString().slice(0, 10), amount: "" })
  const [expense, setExpense] = useState({ categoriaId: "", acreedorId: "", concepto: "", fechaDevengo: new Date().toISOString().slice(0, 10), importe: "", justificante: "FACTURA", file: null as File | null })

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [configResponse, dashboardResponse] = await Promise.all([
        fetch(`/api/pagos/configuracion?entidad=${entity}`),
        fetch(`/api/pagos?entidad=${entity}`),
      ])
      const [nextConfig, nextDashboard] = await Promise.all([configResponse.json(), dashboardResponse.json()])
      if (!configResponse.ok) throw new Error(nextConfig.error || "No se pudo cargar la configuración")
      if (!dashboardResponse.ok) throw new Error(nextDashboard.error || "No se pudo cargar pagos")
      setConfig(nextConfig)
      setDashboard(nextDashboard)
      setPayment((current) => ({ ...current, methodId: current.methodId || nextConfig.medios[0]?.id || "", accountId: current.accountId || nextConfig.cuentas[0]?.id || "" }))
      setExpense((current) => ({ ...current, categoriaId: current.categoriaId || nextConfig.categorias[0]?.id || "" }))
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
    tipoDestino: "FACTURA" as const,
    id: invoice.id,
    entidad: invoice.entidad,
    acreedorId: invoice.acreedorId || "",
    acreedorNombre: invoice.acreedor?.nombre || "Sin acreedor",
    pending: pending(invoice),
    label: `Factura ${invoice.numero || invoice.id}`,
  })).filter((item) => item.acreedorId && item.pending > 0), [dashboard])

  const expenseDocuments = useMemo(() => (dashboard?.expenses || []).map((expenseItem) => ({
    tipoDestino: "GASTO" as const,
    id: expenseItem.id,
    entidad: expenseItem.entidad,
    acreedorId: expenseItem.acreedorId || "",
    acreedorNombre: expenseItem.acreedor?.nombre || "Sin acreedor",
    pending: pending(expenseItem),
    label: expenseItem.concepto || `Gasto ${expenseItem.id}`,
  })).filter((item) => item.acreedorId && item.pending > 0), [dashboard])

  const availableAccounts = (config?.cuentas || []).filter((account) => account.entidad === entity)

  function selectDocument(document: SelectedDocument) {
    setSelected(document)
    setPayment((current) => ({ ...current, amount: document.pending.toFixed(2), accountId: availableAccounts[0]?.id || current.accountId }))
    setError("")
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/pagos/gastos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entidad: entity, categoriaId: expense.categoriaId, acreedorId: expense.acreedorId || undefined, concepto: expense.concepto, fechaDevengo: expense.fechaDevengo, importe: Number(expense.importe), justificante: expense.justificante }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el gasto")
      if (expense.file) {
        const form = new FormData()
        form.set("file", expense.file)
        form.set("gastoId", result.id)
        const attachmentResponse = await fetch("/api/pagos/adjuntos", { method: "POST", body: form })
        const attachmentResult = await attachmentResponse.json()
        if (!attachmentResponse.ok) throw new Error(attachmentResult.error || "El gasto se creó, pero no se pudo guardar el adjunto")
      }
      setSuccess("Gasto registrado y enviado a autorización")
      setExpense((current) => ({ ...current, concepto: "", importe: "", file: null }))
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el gasto")
    } finally { setSaving(false) }
  }

  async function authorizeExpense(id: string, approve: boolean) {
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(`/api/pagos/gastos/${id}/autorizar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autorizadorId: session?.user?.id, aprobar: approve, motivoRechazo: approve ? undefined : "Revisar justificante y concepto" }) })
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
      const response = await fetch("/api/pagos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entidad: entity, fechaPago: payment.date, medioPagoId: payment.methodId, cuentaFondosId: payment.accountId, acreedorId: selected.acreedorId, aplicaciones: [{ tipoDestino: selected.tipoDestino, destinoId: selected.id, importeAplicado: Number(payment.amount) }] }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el pago")
      setSuccess(`Pago ${entity}-${result.numero} registrado correctamente`)
      setSelected(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el pago")
    } finally { setSaving(false) }
  }

  if (loading && !dashboard) return <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">Cargando módulo de pagos...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Salidas documentadas, autorizadas y conciliables</p>
          <p className="text-xs text-gray-400">Los umbrales se administran como parámetros, no desde el navegador.</p>
        </div>
        <label className="text-sm text-gray-600">Entidad <select value={entity} onChange={(event) => setEntity(event.target.value as Entity)} className="ml-2 rounded-md border px-3 py-2 text-sm text-gray-900"><option value="OBRADOR">Obrador</option><option value="CAFETERIA">Cafetería</option></select></label>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>}

      {(!config || config.cuentas.length === 0 || config.medios.length === 0) && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Configuración pendiente.</strong> Antes del primer pago debe existir al menos una cuenta de fondos activa y un medio de pago. Los endpoints de configuración están disponibles para administración.</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Facturas pagables</p><p className="mt-1 text-2xl font-semibold text-gray-900">{invoiceDocuments.length}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Gastos autorizados</p><p className="mt-1 text-2xl font-semibold text-gray-900">{expenseDocuments.length}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Pagos recientes</p><p className="mt-1 text-2xl font-semibold text-gray-900">{dashboard?.payments.length || 0}</p></div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="text-lg font-semibold text-gray-900">Documentos pagables</h2><p className="text-xs text-gray-500">Solo aparecen documentos conformados o gastos autorizados.</p></div><span className="text-xs text-gray-500">{invoiceDocuments.length + expenseDocuments.length} pendientes</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-gray-700"><tr><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Documento</th><th className="px-2 py-2">Acreedor</th><th className="px-2 py-2 text-right">Pendiente</th><th className="px-2 py-2">Acción</th></tr></thead><tbody className="divide-y">{[...invoiceDocuments, ...expenseDocuments].map((document) => <tr key={`${document.tipoDestino}-${document.id}`}><td className="px-2 py-3 text-xs text-gray-500">{document.tipoDestino === "FACTURA" ? "Factura" : "Gasto"}</td><td className="px-2 py-3 font-medium text-gray-900">{document.label}</td><td className="px-2 py-3 font-medium text-gray-900">{document.acreedorNombre}</td><td className="px-2 py-3 text-right font-semibold text-gray-900">{euros(document.pending)}</td><td className="px-2 py-3"><button type="button" onClick={() => selectDocument(document)} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">Pagar</button></td></tr>)}</tbody></table>{invoiceDocuments.length + expenseDocuments.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay documentos pendientes de pago.</p>}</div>
      </section>

      {selected && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-blue-950">Registrar pago</h2><p className="text-sm text-blue-900">{selected.label} · {selected.acreedorNombre}</p><p className="text-xs text-blue-800">El importe total se calcula a partir de las aplicaciones.</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs text-gray-700">Cancelar</button></div><form onSubmit={submitPayment} className="grid gap-3 sm:grid-cols-4"><label className="text-xs text-gray-700">Fecha<input type="date" value={payment.date} onChange={(event) => setPayment({ ...payment, date: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><label className="text-xs text-gray-700">Medio<select value={payment.methodId} onChange={(event) => setPayment({ ...payment, methodId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar...</option>{(config?.medios || []).map((method) => <option key={method.id} value={method.id}>{method.tipo}{method.limiteOperacion ? ` · máx. ${euros(method.limiteOperacion)}` : ""}</option>)}</select></label><label className="text-xs text-gray-700">Cuenta de origen<select value={payment.accountId} onChange={(event) => setPayment({ ...payment, accountId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar...</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.descripcion} · saldo {euros(account.saldoTeorico)}</option>)}</select></label><label className="text-xs text-gray-700">Aplicar<input type="number" min="0.01" max={selected.pending} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><div className="sm:col-span-4"><button type="submit" disabled={saving || !config?.cuentas.length || !config?.medios.length} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">{saving ? "Registrando..." : "Confirmar salida"}</button></div></form></section>}

      <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-gray-900">Registrar gasto corriente</h2><p className="mb-4 text-xs text-gray-500">El gasto queda pendiente de autorización; registrar no significa pagar.</p><form onSubmit={submitExpense} className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-gray-700">Categoría<select value={expense.categoriaId} onChange={(event) => setExpense({ ...expense, categoriaId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="">Seleccionar...</option>{(config?.categorias || []).map((category) => <option key={category.id} value={category.id}>{category.codigo} · {category.nombre}</option>)}</select></label><label className="text-xs text-gray-700">Acreedor<select value={expense.acreedorId} onChange={(event) => setExpense({ ...expense, acreedorId: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900"><option value="">Sin acreedor (compra menor)</option>{(config?.acreedores || []).map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.nombre}</option>)}</select></label><label className="text-xs text-gray-700">Importe<input type="number" min="0.01" step="0.01" value={expense.importe} onChange={(event) => setExpense({ ...expense, importe: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><label className="text-xs text-gray-700 sm:col-span-2">Concepto<input value={expense.concepto} onChange={(event) => setExpense({ ...expense, concepto: event.target.value })} placeholder="Describe el gasto de forma concreta" className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><label className="text-xs text-gray-700">Fecha de devengo<input type="date" value={expense.fechaDevengo} onChange={(event) => setExpense({ ...expense, fechaDevengo: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required /></label><label className="text-xs text-gray-700">Justificante<select value={expense.justificante} onChange={(event) => setExpense({ ...expense, justificante: event.target.value })} className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-gray-900" required><option value="FACTURA">Factura</option><option value="RECIBO">Recibo</option><option value="TICKET">Ticket</option><option value="CONTRATO">Contrato</option><option value="VALE_INTERNO">Vale interno</option><option value="SIN_JUSTIFICANTE">Sin justificante</option></select></label><label className="text-xs text-gray-700 sm:col-span-2">Adjunto<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setExpense({ ...expense, file: event.target.files?.[0] || null })} className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm text-gray-900" /></label><div className="sm:col-span-3"><button type="submit" disabled={saving} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">{saving ? "Guardando..." : "Registrar gasto"}</button></div></form></section>

      {(dashboard?.expenses || []).some((expenseItem) => expenseItem.estado === "PENDIENTE_AUTORIZACION") && <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-3 text-lg font-semibold text-gray-900">Autorizaciones pendientes</h2><div className="space-y-2">{dashboard?.expenses.filter((expenseItem) => expenseItem.estado === "PENDIENTE_AUTORIZACION").map((expenseItem) => <div key={expenseItem.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p className="font-medium">{expenseItem.concepto}</p><p className="text-xs text-gray-500">{expenseItem.categoria?.nombre} · {euros(expenseItem.importe)} · solicitante {expenseItem.id.slice(0, 8)}</p></div><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void authorizeExpense(expenseItem.id, true)} className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Autorizar</button><button type="button" disabled={saving} onClick={() => void authorizeExpense(expenseItem.id, false)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">Rechazar</button></div></div>)}</div></section>}
    </div>
  )
}
