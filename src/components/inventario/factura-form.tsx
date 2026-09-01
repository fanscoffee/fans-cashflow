"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { emptyFacturaDraft, emptyFacturaLinea, parseFacturaText, type FacturaDraft, type FacturaImpuestoDraft, type FacturaLineaDraft } from "@/lib/factura-ocr"
import { extractDocument } from "@/lib/document-ocr"

interface Proveedor { id: string; razonSocial: string; cifNif: string; direccionFiscal?: string | null }
interface Producto { id: string; codigo: string; descripcionTpv: string; umCompra: string | null; umBaseStock: string }
interface Albaran { id: string; codigoAlbaran: string; fechaRecepcion: string; lineas: Array<{ productoId: string; cantidadRecibida: number | string; precioUnitario: number | string; producto: { codigo: string; descripcionTpv: string; umCompra: string | null } }> }

export interface FacturaFormData extends FacturaDraft {
  proveedorId: string
  entidad: "OBRADOR" | "CAFETERIA"
  tipoDocumento: "COMPRA_MERCANCIA" | "GASTO"
  archivoFactura: File | null
  confirmarConAdjunto: boolean
  adjuntoExistente: boolean
  importeConformado: string
  importeRetenido: string
  motivoRetencion: string
  referenciaOrigen: string
  fechaPago: string
  estadoPago: "PENDIENTE"
  importePagado: string
  recepcionIds: string[]
  cifReceptor: string
}

function createInitial(): FacturaFormData {
  return {
    ...emptyFacturaDraft(),
    proveedorId: "",
    entidad: "OBRADOR",
    tipoDocumento: "COMPRA_MERCANCIA",
    archivoFactura: null,
    confirmarConAdjunto: true,
    adjuntoExistente: false,
    importeConformado: "",
    importeRetenido: "0",
    motivoRetencion: "",
    referenciaOrigen: "",
    fechaPago: "",
    estadoPago: "PENDIENTE",
    importePagado: "",
    recepcionIds: [],
    cifReceptor: "B09711078",
  }
}

interface MissingField {
  id: string
  section: string
  label: string
}

function getMissingRequiredFields(data: FacturaFormData): MissingField[] {
  const missing: MissingField[] = []
  const add = (id: string, section: string, label: string) => missing.push({ id, section, label })

  if (!data.proveedorId) add("factura-proveedor", "Identificación", "Proveedor")
  if (!data.numero) add("factura-numero", "Identificación", "Número de factura")
  if (!data.fechaExpedicion) add("factura-fecha-expedicion", "Identificación", "Fecha de expedición")
  if (data.cifReceptor !== "B09711078") add("factura-cif-receptor", "Identificación", "CIF receptor: debe ser B09711078")
  if (!data.razonSocialEmisor) add("factura-razon-social", "Emisor", "Razón social del emisor")
  if (!data.nifEmisor) add("factura-nif-emisor", "Emisor", "NIF del emisor")
  if (!data.domicilioFiscalEmisor) add("factura-domicilio-emisor", "Emisor", "Domicilio fiscal del emisor")
  if (data.confirmarConAdjunto && !data.archivoFactura && !data.adjuntoExistente) add("factura-adjunto", "Documento", "Adjunto PDF o imagen")

  if (data.lineas.length === 0) {
    add("factura-lineas", "Líneas", "Al menos una línea de factura")
  } else {
    data.lineas.forEach((linea, index) => {
      const lineNumber = index + 1
      if (linea.tipoLinea === "PRODUCTO" && !linea.productoId) add(`factura-linea-${index}-producto`, "Líneas", `Línea ${lineNumber}: producto`)
      if (!linea.descripcion) add(`factura-linea-${index}-descripcion`, "Líneas", `Línea ${lineNumber}: descripción`)
      if (linea.cantidad === "") add(`factura-linea-${index}-cantidad`, "Líneas", `Línea ${lineNumber}: cantidad`)
    })
  }

  return missing
}

function Input({ id, label, value, onChange, type = "text", required = false, error = false }: { id?: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; error?: boolean }) {
  return <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input id={id} aria-invalid={error || undefined} type={type} step={type === "number" ? "0.0001" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} /></label>
}

function ProductoCombobox({ id, productos, selectedProducto, value, onSelect, error = false }: { id?: string; productos: Producto[]; selectedProducto?: Producto; value: string; onSelect: (productoId: string) => void; error?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = productos.find((producto) => producto.id === value) || selectedProducto
  const options = selected && !productos.some((producto) => producto.id === selected.id) ? [selected, ...productos] : productos
  const filtered = options.filter((producto) => {
    const query = search.toLowerCase().trim()
    return !query || producto.codigo.toLowerCase().includes(query) || producto.descripcionTpv.toLowerCase().includes(query)
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(productoId: string) {
    onSelect(productoId)
    setOpen(false)
    setSearch("")
  }

  return <div ref={containerRef} className="relative w-full">
    <input id={id} type="text" role="combobox" readOnly value={selected ? `${selected.codigo} - ${selected.descripcionTpv}` : ""} title={selected ? `${selected.codigo} - ${selected.descripcionTpv}` : undefined} placeholder="Buscar producto..." onFocus={() => setOpen(true)} onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="listbox" aria-controls={id ? `${id}-options` : undefined} aria-invalid={error || undefined} className={`w-full min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} />
    {open && <div id={id ? `${id}-options` : undefined} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
      <div className="sticky top-0 bg-white p-1">
        <input type="text" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); setSearch("") } }} placeholder="Escribir para filtrar..." className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-gray-500">Sin resultados</div> : filtered.map((producto) => <button key={producto.id} type="button" role="option" aria-selected={producto.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelect(producto.id)} className={`block w-full px-2 py-1 text-left text-xs hover:bg-blue-50 ${producto.id === value ? "bg-blue-100 font-medium" : ""}`}><span className="font-mono">{producto.codigo}</span>{" "}<span className="text-gray-600">{producto.descripcionTpv}</span></button>)}
    </div>}
  </div>
}

export default function FacturaForm({ initialValues, facturaId, onCancel, onSubmit, saving }: { initialValues?: FacturaFormData; facturaId?: string; onCancel: () => void; onSubmit: (data: FacturaFormData) => Promise<boolean>; saving: boolean }) {
  const [data, setData] = useState<FacturaFormData>(initialValues || createInitial())
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [albaranes, setAlbaranes] = useState<Albaran[]>([])
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrError, setOcrError] = useState("")
  const [documentRead, setDocumentRead] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    Promise.all([
      fetch("/api/inventario/proveedores?pageSize=500").then((response) => response.json()),
      fetch("/api/inventario/facturas/productos").then((response) => response.json()),
    ]).then(([providerData, productData]) => {
      setProveedores(providerData.proveedores || [])
      setProductos(productData.productos || [])
    }).catch(() => setOcrError("No se pudieron cargar catálogos"))
  }, [])

  useEffect(() => {
    if (!data.proveedorId) { setAlbaranes([]); return }
    const params = new URLSearchParams({ proveedorId: data.proveedorId })
    if (facturaId) params.set("facturaId", facturaId)
    fetch(`/api/inventario/facturas/albaranes?${params}`)
      .then((response) => response.json())
      .then((result) => setAlbaranes(result.albaranes || []))
      .catch(() => setAlbaranes([]))
  }, [data.proveedorId, facturaId])
  /* eslint-enable react-hooks/set-state-in-effect */

  function update<K extends keyof FacturaFormData>(field: K, value: FacturaFormData[K]) {
    setData((current) => ({ ...current, [field]: value }))
  }

  async function handleFile(file: File) {
    setOcrError("")
    setOcrStatus("Procesando documento...")
    const pdfCandidate = file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    try {
      const text = await extractDocument(file, setOcrStatus)
      if (!text.trim()) throw new Error("El documento no contiene texto legible")
      const draft = parseFacturaText(text)
       setData((current) => ({ ...current, ...draft, archivoFactura: file, cifReceptor: draft.receptorCifValido ? "B09711078" : "" }))
       const provider = proveedores.find((item) => item.cifNif.replace(/[\s.-]/g, "").toUpperCase() === draft.nifEmisor.replace(/[\s.-]/g, "").toUpperCase())
       if (provider) setData((current) => ({ ...current, ...draft, archivoFactura: file, proveedorId: provider.id, cifReceptor: draft.receptorCifValido ? "B09711078" : "" }))
      setDocumentRead(true)
      setOcrStatus("Documento leído. Revisa datos y confirma.")
    } catch {
      setOcrError(pdfCandidate ? "No se pudo leer el PDF. Comprueba que no esté protegido con contraseña o vuelve a descargarlo." : "No se pudo leer documento. Completa formulario manualmente.")
      setOcrStatus("")
    }
  }

  function updateLine(index: number, patch: Partial<FacturaLineaDraft>) {
    setData((current) => ({ ...current, lineas: current.lineas.map((linea, itemIndex) => itemIndex === index ? { ...linea, ...patch } : linea) }))
  }

  function addLine(tipoLinea: "PRODUCTO" | "CARGO" = "PRODUCTO") {
    const line = emptyFacturaLinea()
    line.tipoLinea = tipoLinea
    setData((current) => ({ ...current, lineas: [...current.lineas, line] }))
  }

  function updateTax(index: number, patch: Partial<FacturaImpuestoDraft>) {
    setData((current) => ({ ...current, impuestos: current.impuestos.map((tax, itemIndex) => itemIndex === index ? { ...tax, ...patch } : tax) }))
  }

  const availableProducts = useMemo(() => {
    const linkedProductIds = new Set(albaranes.filter((albaran) => data.recepcionIds.includes(albaran.id)).flatMap((albaran) => albaran.lineas.map((linea) => linea.productoId)))
    return data.recepcionIds.length ? productos.filter((producto) => linkedProductIds.has(producto.id)) : productos
  }, [albaranes, data.recepcionIds, productos])
  const missingFields = getMissingRequiredFields(data)
  const missingFieldIds = new Set(missingFields.map((field) => field.id))
  const missingRequired = missingFields.length > 0

  function focusMissingField(id: string) {
    const element = document.getElementById(id)
    if (!element) return
    element.scrollIntoView({ behavior: "smooth", block: "center" })
    if (element instanceof HTMLElement) element.focus({ preventScroll: true })
  }

  return (
    <form onSubmit={async (event) => { event.preventDefault(); if (!missingRequired) await onSubmit(data) }} className="space-y-5">
       <div id="factura-adjunto" className="rounded-md border border-blue-100 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Leer PDF / imagen / foto</button>
           <input ref={fileInputRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void handleFile(file) }} />
           {documentRead && <span className="text-xs text-green-800">Documento leído</span>}
           {data.adjuntoExistente && !data.archivoFactura && <span className="text-xs text-green-800">Adjunto existente</span>}
        </div>
        <p className="mt-1 text-xs text-blue-800">El contenido se procesa localmente y el archivo se conserva como adjunto al confirmar si Storage está configurado.</p>
        {ocrStatus && <p className="mt-1 text-xs text-blue-800">{ocrStatus}</p>}
        {ocrError && <p className="mt-1 text-xs text-red-700">{ocrError}</p>}
      </div>
      {missingFields.length > 0 ? <section aria-live="polite" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Faltan {missingFields.length} campos obligatorios</h3>
          <span className="text-xs">Los campos opcionales no aparecen aquí.</span>
        </div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {missingFields.map((field) => <li key={field.id} className="flex items-center gap-1 text-xs">
            <span aria-hidden="true">•</span>
            <button type="button" onClick={() => focusMissingField(field.id)} className="text-left font-medium underline decoration-dotted underline-offset-2 hover:text-red-700">{field.label}</button>
            <span className="text-red-700/70">({field.section})</span>
          </li>)}
        </ul>
      </section> : <p aria-live="polite" className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800">Campos obligatorios completos. Ya puedes confirmar la factura.</p>}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Identificación</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Proveedor *</span><select id="factura-proveedor" aria-invalid={missingFieldIds.has("factura-proveedor") || undefined} value={data.proveedorId} onChange={(event) => { const provider = proveedores.find((item) => item.id === event.target.value); update("proveedorId", event.target.value); if (provider) setData((current) => ({ ...current, razonSocialEmisor: provider.razonSocial, nifEmisor: provider.cifNif, domicilioFiscalEmisor: provider.direccionFiscal || "" })) }} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 ${missingFieldIds.has("factura-proveedor") ? "border-red-500 bg-red-50" : "border-gray-300"}`}><option value="">Seleccionar...</option>{proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.razonSocial} — {provider.cifNif}</option>)}</select></label>
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Entidad *</span><select value={data.entidad} onChange={(event) => update("entidad", event.target.value as FacturaFormData["entidad"])} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"><option value="OBRADOR">Obrador</option><option value="CAFETERIA">Cafetería</option></select></label>
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Tipo *</span><select value={data.tipoDocumento} onChange={(event) => update("tipoDocumento", event.target.value as FacturaFormData["tipoDocumento"])} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"><option value="COMPRA_MERCANCIA">Compra mercancía</option><option value="GASTO">Gasto</option></select></label>
          <Input label="Serie" value={data.serie} onChange={(value) => update("serie", value)} />
          <Input id="factura-numero" label="Número factura" value={data.numero} onChange={(value) => update("numero", value)} required error={missingFieldIds.has("factura-numero")} />
          <Input id="factura-fecha-expedicion" label="Fecha expedición" type="date" value={data.fechaExpedicion} onChange={(value) => update("fechaExpedicion", value)} required error={missingFieldIds.has("factura-fecha-expedicion")} />
          <Input label="Fecha operación" type="date" value={data.fechaOperacion} onChange={(value) => update("fechaOperacion", value)} />
          <Input label="Vencimiento" type="date" value={data.fechaVencimiento} onChange={(value) => update("fechaVencimiento", value)} />
          <Input label="Fecha pago" type="date" value={data.fechaPago} onChange={(value) => update("fechaPago", value)} />
          <Input label="Nº pedido" value={data.numeroPedido} onChange={(value) => update("numeroPedido", value)} />
          <Input label="Fecha pedido" type="date" value={data.fechaPedido} onChange={(value) => update("fechaPedido", value)} />
          <Input label="Centro entrega" value={data.centroEntrega} onChange={(value) => update("centroEntrega", value)} />
          <Input label="Referencia albarán" value={data.referenciaAlbaran} onChange={(value) => update("referenciaAlbaran", value)} />
          <Input label="Fecha albarán" type="date" value={data.fechaAlbaran} onChange={(value) => update("fechaAlbaran", value)} />
          <Input label="Forma de pago" value={data.formaPago} onChange={(value) => update("formaPago", value)} />
          <Input label="Importe pagado" type="number" value={data.importePagado} onChange={(value) => update("importePagado", value)} />
          <Input id="factura-cif-receptor" label="CIF receptor" value={data.cifReceptor} onChange={(value) => update("cifReceptor", value.toUpperCase())} required error={missingFieldIds.has("factura-cif-receptor")} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Emisor</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input id="factura-razon-social" label="Razón social" value={data.razonSocialEmisor} onChange={(value) => update("razonSocialEmisor", value)} required error={missingFieldIds.has("factura-razon-social")} />
          <Input id="factura-nif-emisor" label="NIF" value={data.nifEmisor} onChange={(value) => update("nifEmisor", value.toUpperCase())} required error={missingFieldIds.has("factura-nif-emisor")} />
          <Input id="factura-domicilio-emisor" label="Domicilio fiscal" value={data.domicilioFiscalEmisor} onChange={(value) => update("domicilioFiscalEmisor", value)} required error={missingFieldIds.has("factura-domicilio-emisor")} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">Albaranes vinculados</h3><span className="text-xs text-gray-500">Solo albaranes libres del proveedor</span></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {albaranes.map((albaran) => <label key={albaran.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs hover:bg-gray-50"><input type="checkbox" checked={data.recepcionIds.includes(albaran.id)} onChange={(event) => update("recepcionIds", event.target.checked ? [...data.recepcionIds, albaran.id] : data.recepcionIds.filter((id) => id !== albaran.id))} className="mt-0.5" /><span><strong>{albaran.codigoAlbaran}</strong> — {new Date(albaran.fechaRecepcion).toLocaleDateString("es-ES")} — {albaran.lineas.length} líneas</span></label>)}
          {data.proveedorId && albaranes.length === 0 && <p className="text-xs text-gray-500">No hay albaranes libres para este proveedor.</p>}
        </div>
      </section>

      <section id="factura-lineas">
         <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-gray-900">Líneas</h3><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" onClick={() => addLine("PRODUCTO")} className="min-h-11 rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:py-1">+ Producto</button><button type="button" onClick={() => addLine("CARGO")} className="min-h-11 rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:py-1">+ Cargo</button></div></div>
        <div className="space-y-3">
          {data.lineas.map((linea, index) => <div key={`${index}-${linea.referenciaProveedor}`} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Tipo</span><select value={linea.tipoLinea} onChange={(event) => updateLine(index, { tipoLinea: event.target.value as "PRODUCTO" | "CARGO" })} className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="PRODUCTO">Producto</option><option value="CARGO">Cargo</option></select></label>
              {linea.tipoLinea === "PRODUCTO" ? <label className="block text-xs text-gray-600 sm:col-span-2"><span className="mb-1 block font-medium">Producto *</span><ProductoCombobox id={`factura-linea-${index}-producto`} productos={availableProducts} selectedProducto={productos.find((product) => product.id === linea.productoId)} value={linea.productoId} onSelect={(productoId) => { const product = productos.find((item) => item.id === productoId); updateLine(index, { productoId, descripcion: product?.descripcionTpv || linea.descripcion, unidadMedida: product?.umCompra || linea.unidadMedida }) }} error={missingFieldIds.has(`factura-linea-${index}-producto`)} /></label> : <Input label="Descripción cargo" value={linea.descripcion} onChange={(value) => updateLine(index, { descripcion: value })} required error={missingFieldIds.has(`factura-linea-${index}-descripcion`)} />}
               <Input label="Ref. proveedor" value={linea.referenciaProveedor} onChange={(value) => updateLine(index, { referenciaProveedor: value })} />
               <Input label="Código artículo" value={linea.codigoArticulo} onChange={(value) => updateLine(index, { codigoArticulo: value })} />
               <Input id={`factura-linea-${index}-descripcion`} label="Descripción" value={linea.descripcion} onChange={(value) => updateLine(index, { descripcion: value })} required error={missingFieldIds.has(`factura-linea-${index}-descripcion`)} />
              <Input label="U.Medida" value={linea.unidadMedida} onChange={(value) => updateLine(index, { unidadMedida: value })} />
              <Input label="Formato original" value={linea.formatoOriginal} onChange={(value) => updateLine(index, { formatoOriginal: value })} />
              <Input id={`factura-linea-${index}-cantidad`} label="Cantidad" type="number" value={linea.cantidad} onChange={(value) => updateLine(index, { cantidad: value })} required error={missingFieldIds.has(`factura-linea-${index}-cantidad`)} />
              <Input label="Descuento %" type="number" value={linea.descuentoPorcentaje} onChange={(value) => updateLine(index, { descuentoPorcentaje: value })} />
              <Input label="Descuento importe" type="number" value={linea.descuentoImporte} onChange={(value) => updateLine(index, { descuentoImporte: value })} />
              <Input label="Precio unitario" type="number" value={linea.precioUnitario} onChange={(value) => updateLine(index, { precioUnitario: value })} />
              <Input label="Precio unitario neto" type="number" value={linea.precioUnitarioNeto} onChange={(value) => updateLine(index, { precioUnitarioNeto: value })} />
              <Input label="Base imponible" type="number" value={linea.baseImponible} onChange={(value) => updateLine(index, { baseImponible: value })} />
              <Input label="IVA %" type="number" value={linea.tipoIva} onChange={(value) => updateLine(index, { tipoIva: value })} />
              <Input label="Cuota IVA" type="number" value={linea.cuotaIva} onChange={(value) => updateLine(index, { cuotaIva: value })} />
              <Input label="Total línea" type="number" value={linea.totalLinea} onChange={(value) => updateLine(index, { totalLinea: value })} />
              <Input label="Lote" value={linea.lote} onChange={(value) => updateLine(index, { lote: value })} />
              <Input label="Caducidad" type="date" value={linea.fechaVencimiento} onChange={(value) => updateLine(index, { fechaVencimiento: value })} />
            </div>
            <button type="button" onClick={() => setData((current) => ({ ...current, lineas: current.lineas.filter((_, itemIndex) => itemIndex !== index) }))} className="mt-2 text-xs text-red-600">Eliminar línea</button>
          </div>)}
        </div>
      </section>

      <section>
         <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-gray-900">Impuestos</h3><button type="button" onClick={() => update("impuestos", [...data.impuestos, { tipo: "IVA", porcentaje: "0", baseImponible: "0", cuota: "0" }])} className="min-h-11 w-full rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:w-auto sm:py-1">+ Impuesto</button></div>
        <div className="space-y-2">{data.impuestos.map((tax, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-5"><select value={tax.tipo} onChange={(event) => updateTax(index, { tipo: event.target.value as FacturaImpuestoDraft["tipo"] })} className="rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="IVA">IVA</option><option value="RECARGO_EQUIVALENCIA">Recargo equivalencia</option><option value="IRPF">IRPF</option></select><Input label="%" type="number" value={tax.porcentaje} onChange={(value) => updateTax(index, { porcentaje: value })} /><Input label="Base" type="number" value={tax.baseImponible} onChange={(value) => updateTax(index, { baseImponible: value })} /><Input label="Cuota" type="number" value={tax.cuota} onChange={(value) => updateTax(index, { cuota: value })} /><button type="button" onClick={() => update("impuestos", data.impuestos.filter((_, itemIndex) => itemIndex !== index))} className="self-end pb-2 text-xs text-red-600">Eliminar</button></div>)}</div>
      </section>

        <section><h3 className="mb-2 text-sm font-semibold text-gray-900">Totales</h3><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-5"><Input label="Total neto" type="number" value={data.totalNeto} onChange={(value) => update("totalNeto", value)} /><Input label="Total descuento" type="number" value={data.totalDescuento} onChange={(value) => update("totalDescuento", value)} /><Input label="Total IVA" type="number" value={data.totalIva} onChange={(value) => update("totalIva", value)} /><Input label="Total recargo" type="number" value={data.totalRecargo} onChange={(value) => update("totalRecargo", value)} /><Input label="Total retenciones" type="number" value={data.totalRetenciones} onChange={(value) => update("totalRetenciones", value)} /><Input label="Importe total" type="number" value={data.importeTotal} onChange={(value) => update("importeTotal", value)} /></div></section>
      <Input label="Observaciones" value={data.observaciones} onChange={(value) => update("observaciones", value)} />
      {data.cifReceptor !== "B09711078" && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">CIF receptor incorrecto. Debe ser B09711078.</p>}
        <div className="flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={missingRequired || saving} className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto">{saving ? "Guardando..." : missingRequired ? `Faltan ${missingFields.length} campos` : "Confirmar factura"}</button><button type="button" onClick={onCancel} className="w-full rounded-md border px-4 py-2 text-sm text-gray-700 sm:w-auto">Cancelar</button></div>
    </form>
  )
}
