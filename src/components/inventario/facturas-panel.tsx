"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import FacturaForm, { type FacturaFormData } from "./factura-form"

interface FacturaListItem {
  id: string
  serie: string
  numero: string
  fechaExpedicion: string
  estado: string
  estadoPago: string
  estadoCircuito?: string
  entidad?: "OBRADOR" | "CAFETERIA"
  importeConformado?: number | string | null
  importeRetenido?: number | string | null
  importeTotal: number | string
  alertas: unknown
  proveedor: { id: string; razonSocial: string; cifNif: string }
  confirmadoPor: { name: string | null } | null
  _count: { lineas: number; albaranes: number }
}

interface FacturaDetail extends FacturaListItem {
  tipoDocumento?: "COMPRA_MERCANCIA" | "GASTO"
  fechaOperacion: string | null
  fechaVencimiento: string | null
  fechaPago: string | null
  numeroPedido: string | null
  fechaPedido: string | null
  centroEntrega: string | null
  referenciaAlbaran: string | null
  fechaAlbaran: string | null
  formaPago: string | null
  importePagado: number | string | null
  razonSocialEmisor: string
  nifEmisor: string
  domicilioFiscalEmisor: string
  totalNeto: number | string
  totalDescuento: number | string
  totalIva: number | string
  totalRecargo: number | string
  totalRetenciones: number | string
  observaciones: string | null
  albaranes: Array<{ id: string; codigoAlbaran: string; fechaRecepcion: string }>
  lineas: Array<{ id: string; productoId: string | null; tipoLinea: string; referenciaProveedor: string | null; codigoArticulo: string | null; descripcion: string; unidadMedida: string | null; formatoOriginal: string | null; cantidad: number | string; descuentoPorcentaje: number | string | null; descuentoImporte: number | string; precioUnitario: number | string; precioUnitarioNeto: number | string; baseImponible: number | string; tipoIva: number | string | null; cuotaIva: number | string; totalLinea: number | string; lote: string | null; fechaVencimiento: string | null; alertaValidacion: string | null; producto: { id: string; codigo: string; descripcionTpv: string; umCompra: string | null } | null }>
  impuestos: Array<{ tipo: "IVA" | "RECARGO_EQUIVALENCIA" | "IRPF"; porcentaje: number | string | null; baseImponible: number | string; cuota: number | string }>
  adjuntos: Array<{ id: string; nombreArchivo: string; mimeType: string }>
}

function number(value: unknown) { return Number(value || 0).toFixed(2) }
function dateInput(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 10) : "" }

function toFormValues(factura: FacturaDetail): FacturaFormData {
  return {
    proveedorId: factura.proveedor.id,
    entidad: factura.entidad || "OBRADOR",
    tipoDocumento: factura.tipoDocumento || "COMPRA_MERCANCIA",
    archivoFactura: null,
    confirmarConAdjunto: true,
    adjuntoExistente: factura.adjuntos.length > 0,
    importeConformado: factura.importeConformado == null ? "" : number(factura.importeConformado),
    importeRetenido: factura.importeRetenido == null ? "0" : number(factura.importeRetenido),
    motivoRetencion: "",
    referenciaOrigen: "",
    serie: factura.serie,
    numero: factura.numero,
    fechaExpedicion: dateInput(factura.fechaExpedicion),
    fechaOperacion: dateInput(factura.fechaOperacion),
    fechaVencimiento: dateInput(factura.fechaVencimiento),
    fechaPago: dateInput(factura.fechaPago),
    numeroPedido: factura.numeroPedido || "",
    fechaPedido: dateInput(factura.fechaPedido),
    centroEntrega: factura.centroEntrega || "",
    referenciaAlbaran: factura.referenciaAlbaran || "",
    fechaAlbaran: dateInput(factura.fechaAlbaran),
    formaPago: factura.formaPago || "",
    estadoPago: "PENDIENTE",
    razonSocialEmisor: factura.razonSocialEmisor,
    nifEmisor: factura.nifEmisor,
    domicilioFiscalEmisor: factura.domicilioFiscalEmisor,
    totalNeto: number(factura.totalNeto),
    totalDescuento: number(factura.totalDescuento),
    totalIva: number(factura.totalIva),
    totalRecargo: number(factura.totalRecargo),
    totalRetenciones: number(factura.totalRetenciones),
    importeTotal: number(factura.importeTotal),
    importePagado: factura.importePagado == null ? "" : number(factura.importePagado),
    observaciones: factura.observaciones || "",
    receptorCifValido: true,
    cifReceptor: "B09711078",
    recepcionIds: factura.albaranes.map((albaran) => albaran.id),
    lineas: factura.lineas.map((linea) => ({
      productoId: linea.productoId || "",
      tipoLinea: linea.tipoLinea === "CARGO" ? "CARGO" : "PRODUCTO",
      referenciaProveedor: linea.referenciaProveedor || "",
      codigoArticulo: linea.codigoArticulo || "",
      descripcion: linea.descripcion,
      unidadMedida: linea.unidadMedida || "",
      formatoOriginal: linea.formatoOriginal || "",
      cantidad: String(linea.cantidad),
      descuentoPorcentaje: String(linea.descuentoPorcentaje || 0),
      descuentoImporte: String(linea.descuentoImporte),
      precioUnitario: String(linea.precioUnitario),
      precioUnitarioNeto: String(linea.precioUnitarioNeto),
      baseImponible: String(linea.baseImponible),
      tipoIva: String(linea.tipoIva || 0),
      cuotaIva: String(linea.cuotaIva),
      totalLinea: String(linea.totalLinea),
      lote: linea.lote || "",
      fechaVencimiento: dateInput(linea.fechaVencimiento),
    })),
    impuestos: factura.impuestos.map((impuesto) => ({ tipo: impuesto.tipo, porcentaje: String(impuesto.porcentaje || 0), baseImponible: String(impuesto.baseImponible), cuota: String(impuesto.cuota) })),
  }
}

export default function FacturasPanel() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [view, setView] = useState<"list" | "create" | "detail" | "edit">("list")
  const [facturas, setFacturas] = useState<FacturaListItem[]>([])
  const [selected, setSelected] = useState<FacturaDetail | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const pageSize = 20

  const loadFacturas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set("search", search)
      const response = await fetch(`/api/inventario/facturas?${params}`)
      if (!response.ok) throw new Error("Error al cargar facturas")
      const data = await response.json()
      setFacturas(data.facturas || [])
      setTotal(data.total || 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error desconocido")
    } finally { setLoading(false) }
  }, [page, search])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { loadFacturas() }, [loadFacturas])
  useEffect(() => { setPage(1) }, [search])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function saveFactura(data: FacturaFormData, id?: string) {
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(id ? `/api/inventario/facturas/${id}` : "/api/inventario/facturas", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
       const result = await response.json()
       if (!response.ok) throw new Error(result.error || "Error al guardar factura")
       if (data.archivoFactura && result.factura?.id) {
         const form = new FormData()
         form.set("file", data.archivoFactura)
         form.set("facturaId", result.factura.id)
         const attachmentResponse = await fetch("/api/pagos/adjuntos", { method: "POST", body: form })
         const attachmentResult = await attachmentResponse.json()
         if (!attachmentResponse.ok) throw new Error(attachmentResult.error || "La factura se guardó, pero no se pudo guardar el adjunto")
       }
       if (data.confirmarConAdjunto && result.factura?.id) {
         const conformResponse = await fetch(`/api/inventario/facturas/${result.factura.id}/conformar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entidad: data.entidad, importeConformado: Number(data.importeConformado || data.importeTotal), importeRetenido: Number(data.importeRetenido || 0), motivoRetencion: data.motivoRetencion, referenciaOrigen: data.referenciaOrigen }) })
         const conformResult = await conformResponse.json()
         if (!conformResponse.ok) throw new Error(conformResult.error || "La factura se guardó, pero no pudo conformarse")
       }
      setSuccess(result.alertas?.length ? `Factura guardada con ${result.alertas.length} alerta(s)` : "Factura guardada")
      setView("list")
      await loadFacturas()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error desconocido")
      return false
    } finally { setSaving(false) }
  }

  async function showDetail(id: string, target: "detail" | "edit" = "detail") {
    setError("")
    const response = await fetch(`/api/inventario/facturas/${id}`)
    if (!response.ok) { setError("No se pudo cargar factura"); return }
    setSelected(await response.json())
    setView(target)
  }

  async function annul(id: string) {
    if (!confirm("¿Anular esta factura? No se borrará físicamente.")) return
    const response = await fetch(`/api/inventario/facturas/${id}`, { method: "DELETE" })
    if (!response.ok) { const result = await response.json(); setError(result.error || "No se pudo anular"); return }
    setSuccess("Factura anulada"); await loadFacturas()
  }

  if (view === "create" || (view === "edit" && selected)) return <div className="rounded-lg border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">{view === "edit" ? "Editar factura" : "Nueva factura"}</h2><button type="button" onClick={() => setView("list")} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div>{error && <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<FacturaForm facturaId={view === "edit" ? selected?.id : undefined} initialValues={view === "edit" && selected ? toFormValues(selected) : undefined} onCancel={() => setView("list")} onSubmit={(data) => saveFactura(data, view === "edit" ? selected?.id : undefined)} saving={saving} /></div>

  if (view === "detail" && selected) return <div className="rounded-lg border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Factura {selected.serie ? `${selected.serie}/` : ""}{selected.numero}</h2><p className="text-sm text-gray-500">{selected.proveedor.razonSocial} · {new Date(selected.fechaExpedicion).toLocaleDateString("es-ES")}</p></div><button type="button" onClick={() => { setSelected(null); setView("list") }} className="rounded-md border px-3 py-2 text-sm text-gray-700">Volver</button></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><div><span className="text-gray-500">Neto</span><p>{number(selected.totalNeto)} €</p></div><div><span className="text-gray-500">IVA</span><p>{number(selected.totalIva)} €</p></div><div><span className="text-gray-500">Recargo</span><p>{number(selected.totalRecargo)} €</p></div><div><span className="text-gray-500">Retenciones</span><p>{number(selected.totalRetenciones)} €</p></div><div><span className="text-gray-500">Total</span><p className="font-semibold">{number(selected.importeTotal)} €</p></div></div><div className="mt-4 rounded-md border p-3 text-sm"><p><strong>Emisor:</strong> {selected.razonSocialEmisor} · {selected.nifEmisor}</p><p><strong>Pago:</strong> {selected.estadoPago} {selected.formaPago ? `· ${selected.formaPago}` : ""}</p><p><strong>Albaranes:</strong> {selected.albaranes.length ? selected.albaranes.map((albaran) => albaran.codigoAlbaran).join(", ") : "Sin vínculo"}</p></div>{Array.isArray(selected.alertas) && selected.alertas.length > 0 && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Alertas</strong>{selected.alertas.map((alerta, index) => <p key={index}>{String(alerta)}</p>)}</div>}<div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2">Precio neto</th><th className="px-3 py-2">IVA</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y">{selected.lineas.map((linea) => <tr key={linea.id}><td className="px-3 py-2">{linea.producto?.codigo || "Cargo"} — {linea.descripcion}{linea.alertaValidacion && <p className="text-xs text-amber-700">{linea.alertaValidacion}</p>}</td><td className="px-3 py-2">{String(linea.cantidad)} {linea.unidadMedida || ""}</td><td className="px-3 py-2">{number(linea.precioUnitarioNeto)} €</td><td className="px-3 py-2">{String(linea.tipoIva || 0)}%</td><td className="px-3 py-2 text-right">{number(linea.totalLinea)} €</td></tr>)}</tbody></table></div>{isAdmin && <div className="mt-4 flex gap-2"><button type="button" onClick={() => setView("edit")} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">Editar</button><button type="button" onClick={() => annul(selected.id)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Anular</button></div>}</div>

  const totalPages = Math.ceil(total / pageSize)
  return <div className="space-y-4">{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setError(""); setView("create") }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">+ Nueva factura</button><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, serie, NIF..." className="min-w-56 rounded-md border px-3 py-2 text-sm text-gray-900" /><span className="ml-auto text-sm text-gray-500">{total} factura(s)</span></div>{loading ? <p className="text-sm text-gray-500">Cargando...</p> : facturas.length === 0 ? <p className="text-sm text-gray-500">No hay facturas.</p> : <div className="overflow-x-auto rounded-md border bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-2">Factura</th><th className="px-3 py-2">Proveedor</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Albaranes</th><th className="px-3 py-2">Pago</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead><tbody className="divide-y">{facturas.map((factura) => <tr key={factura.id}><td className="px-3 py-2 font-medium">{factura.serie ? `${factura.serie}/` : ""}{factura.numero}{factura.estado === "ANULADA" && <span className="ml-2 text-xs text-red-600">ANULADA</span>}{Array.isArray(factura.alertas) && factura.alertas.length > 0 && <span className="ml-2 text-xs text-amber-600">⚠ {factura.alertas.length}</span>}</td><td className="px-3 py-2">{factura.proveedor.razonSocial}</td><td className="px-3 py-2">{new Date(factura.fechaExpedicion).toLocaleDateString("es-ES")}</td><td className="px-3 py-2">{factura._count.albaranes}</td><td className="px-3 py-2">{factura.estadoPago}</td><td className="px-3 py-2 text-right">{number(factura.importeTotal)} €</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => showDetail(factura.id)} className="mr-2 text-xs text-blue-700">Ver</button>{isAdmin && <button type="button" onClick={() => annul(factura.id)} className="text-xs text-red-700">Anular</button>}</td></tr>)}</tbody></table></div>}{totalPages > 1 && <div className="flex justify-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Anterior</button><span className="px-2 py-1 text-sm">Página {page}/{totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Siguiente</button></div>}
  </div>
}
