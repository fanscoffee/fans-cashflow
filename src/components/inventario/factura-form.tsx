"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createWorker, PSM } from "tesseract.js"
import { emptyFacturaDraft, emptyFacturaLinea, parseFacturaText, type FacturaDraft, type FacturaImpuestoDraft, type FacturaLineaDraft } from "@/lib/factura-ocr"

interface Proveedor { id: string; razonSocial: string; cifNif: string; direccionFiscal?: string | null }
interface Producto { id: string; codigo: string; descripcionTpv: string; umCompra: string | null; umBaseStock: string }
interface Albaran { id: string; codigoAlbaran: string; fechaRecepcion: string; lineas: Array<{ productoId: string; cantidadRecibida: number | string; precioUnitario: number | string; producto: { codigo: string; descripcionTpv: string; umCompra: string | null } }> }

export interface FacturaFormData extends FacturaDraft {
  proveedorId: string
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
    fechaPago: "",
    estadoPago: "PENDIENTE",
    importePagado: "",
    recepcionIds: [],
    cifReceptor: "B09711078",
  }
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input type={type} step={type === "number" ? "0.0001" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></label>
}

async function recognizeImage(file: Blob | HTMLCanvasElement, setStatus: (value: string) => void) {
  const worker = await createWorker("spa", 1, { logger: (message) => message.status && setStatus(`${message.status} ${Math.round(message.progress * 100)}%`) })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" })
    const result = await worker.recognize(file)
    return result.data.text
  } finally {
    await worker.terminate()
  }
}

async function extractDocument(file: File, setStatus: (value: string) => void) {
  if (file.type !== "application/pdf") return recognizeImage(file, setStatus)

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const buffer = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setStatus(`Leyendo página ${pageNumber}/${pdf.numPages}`)
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ")
    pages.push(text)
  }
  const text = pages.join("\n")
  if (text.trim().length > 40) return text

  const ocrPages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise
    ocrPages.push(await recognizeImage(canvas, setStatus))
  }
  return ocrPages.join("\n")
}

export default function FacturaForm({ initialValues, facturaId, onCancel, onSubmit, saving }: { initialValues?: FacturaFormData; facturaId?: string; onCancel: () => void; onSubmit: (data: FacturaFormData) => Promise<boolean>; saving: boolean }) {
  const [data, setData] = useState<FacturaFormData>(initialValues || createInitial())
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [albaranes, setAlbaranes] = useState<Albaran[]>([])
  const [productSearch, setProductSearch] = useState("")
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
    try {
      const text = await extractDocument(file, setOcrStatus)
      const draft = parseFacturaText(text)
      setData((current) => ({ ...current, ...draft, cifReceptor: draft.receptorCifValido ? "B09711078" : "" }))
      const provider = proveedores.find((item) => item.cifNif.replace(/[\s.-]/g, "").toUpperCase() === draft.nifEmisor.replace(/[\s.-]/g, "").toUpperCase())
      if (provider) setData((current) => ({ ...current, ...draft, proveedorId: provider.id, cifReceptor: draft.receptorCifValido ? "B09711078" : "" }))
      setDocumentRead(true)
      setOcrStatus("Documento leído. Revisa datos y confirma.")
    } catch {
      setOcrError("No se pudo leer documento. Completa formulario manualmente.")
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

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase()
    const linkedProductIds = new Set(albaranes.filter((albaran) => data.recepcionIds.includes(albaran.id)).flatMap((albaran) => albaran.lineas.map((linea) => linea.productoId)))
    const source = data.recepcionIds.length ? productos.filter((producto) => linkedProductIds.has(producto.id)) : productos
    return source.filter((producto) => !query || producto.codigo.toLowerCase().includes(query) || producto.descripcionTpv.toLowerCase().includes(query))
  }, [albaranes, data.recepcionIds, productSearch, productos])
  const missingRequired = !data.proveedorId || !data.numero || !data.fechaExpedicion || !data.razonSocialEmisor || !data.nifEmisor || !data.domicilioFiscalEmisor || data.cifReceptor !== "B09711078" || data.lineas.length === 0 || data.lineas.some((linea) => !linea.descripcion || linea.cantidad === "" || (linea.tipoLinea === "PRODUCTO" && !linea.productoId))

  return (
    <form onSubmit={async (event) => { event.preventDefault(); if (!missingRequired) await onSubmit(data) }} className="space-y-5">
      <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Leer PDF / imagen / foto</button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
          {documentRead && <span className="text-xs text-green-800">Documento leído</span>}
        </div>
        <p className="mt-1 text-xs text-blue-800">Procesamiento local. Archivo no se guarda.</p>
        {ocrStatus && <p className="mt-1 text-xs text-blue-800">{ocrStatus}</p>}
        {ocrError && <p className="mt-1 text-xs text-red-700">{ocrError}</p>}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Identificación</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Proveedor *</span><select value={data.proveedorId} onChange={(event) => { const provider = proveedores.find((item) => item.id === event.target.value); update("proveedorId", event.target.value); if (provider) setData((current) => ({ ...current, razonSocialEmisor: provider.razonSocial, nifEmisor: provider.cifNif, domicilioFiscalEmisor: provider.direccionFiscal || "" })) }} className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="">Seleccionar...</option>{proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.razonSocial} — {provider.cifNif}</option>)}</select></label>
          <Input label="Serie" value={data.serie} onChange={(value) => update("serie", value)} />
          <Input label="Número factura" value={data.numero} onChange={(value) => update("numero", value)} required />
          <Input label="Fecha expedición" type="date" value={data.fechaExpedicion} onChange={(value) => update("fechaExpedicion", value)} required />
          <Input label="Fecha operación" type="date" value={data.fechaOperacion} onChange={(value) => update("fechaOperacion", value)} />
          <Input label="Vencimiento" type="date" value={data.fechaVencimiento} onChange={(value) => update("fechaVencimiento", value)} />
          <Input label="Fecha pago" type="date" value={data.fechaPago} onChange={(value) => update("fechaPago", value)} />
          <Input label="Forma de pago" value={data.formaPago} onChange={(value) => update("formaPago", value)} />
          <Input label="Importe pagado" type="number" value={data.importePagado} onChange={(value) => update("importePagado", value)} />
          <Input label="CIF receptor" value={data.cifReceptor} onChange={(value) => update("cifReceptor", value.toUpperCase())} required />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Emisor</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Razón social" value={data.razonSocialEmisor} onChange={(value) => update("razonSocialEmisor", value)} required />
          <Input label="NIF" value={data.nifEmisor} onChange={(value) => update("nifEmisor", value.toUpperCase())} required />
          <Input label="Domicilio fiscal" value={data.domicilioFiscalEmisor} onChange={(value) => update("domicilioFiscalEmisor", value)} required />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">Albaranes vinculados</h3><span className="text-xs text-gray-500">Solo albaranes libres del proveedor</span></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {albaranes.map((albaran) => <label key={albaran.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs hover:bg-gray-50"><input type="checkbox" checked={data.recepcionIds.includes(albaran.id)} onChange={(event) => update("recepcionIds", event.target.checked ? [...data.recepcionIds, albaran.id] : data.recepcionIds.filter((id) => id !== albaran.id))} className="mt-0.5" /><span><strong>{albaran.codigoAlbaran}</strong> — {new Date(albaran.fechaRecepcion).toLocaleDateString("es-ES")} — {albaran.lineas.length} líneas</span></label>)}
          {data.proveedorId && albaranes.length === 0 && <p className="text-xs text-gray-500">No hay albaranes libres para este proveedor.</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">Líneas</h3><div className="flex gap-2"><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar producto..." className="rounded-md border px-2 py-1 text-xs text-gray-900" /><button type="button" onClick={() => addLine("PRODUCTO")} className="rounded-md border px-2 py-1 text-xs text-gray-700">+ Producto</button><button type="button" onClick={() => addLine("CARGO")} className="rounded-md border px-2 py-1 text-xs text-gray-700">+ Cargo</button></div></div>
        <div className="space-y-3">
          {data.lineas.map((linea, index) => <div key={`${index}-${linea.referenciaProveedor}`} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Tipo</span><select value={linea.tipoLinea} onChange={(event) => updateLine(index, { tipoLinea: event.target.value as "PRODUCTO" | "CARGO" })} className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="PRODUCTO">Producto</option><option value="CARGO">Cargo</option></select></label>
              {linea.tipoLinea === "PRODUCTO" ? <label className="block text-xs text-gray-600 sm:col-span-2"><span className="mb-1 block font-medium">Producto *</span><select value={linea.productoId} onChange={(event) => { const product = productos.find((item) => item.id === event.target.value); updateLine(index, { productoId: event.target.value, descripcion: product?.descripcionTpv || linea.descripcion, unidadMedida: product?.umCompra || linea.unidadMedida }) }} className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="">Seleccionar...</option>{linea.productoId && !filteredProducts.some((product) => product.id === linea.productoId) && <option value={linea.productoId}>Producto fuera de albarán</option>}{filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.codigo} — {product.descripcionTpv}</option>)}</select></label> : <Input label="Descripción cargo" value={linea.descripcion} onChange={(value) => updateLine(index, { descripcion: value })} required />}
              <Input label="Ref. proveedor" value={linea.referenciaProveedor} onChange={(value) => updateLine(index, { referenciaProveedor: value })} />
              <Input label="Descripción" value={linea.descripcion} onChange={(value) => updateLine(index, { descripcion: value })} required />
              <Input label="U.Medida" value={linea.unidadMedida} onChange={(value) => updateLine(index, { unidadMedida: value })} />
              <Input label="Formato original" value={linea.formatoOriginal} onChange={(value) => updateLine(index, { formatoOriginal: value })} />
              <Input label="Cantidad" type="number" value={linea.cantidad} onChange={(value) => updateLine(index, { cantidad: value })} required />
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
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Impuestos</h3><button type="button" onClick={() => update("impuestos", [...data.impuestos, { tipo: "IVA", porcentaje: "0", baseImponible: "0", cuota: "0" }])} className="rounded-md border px-2 py-1 text-xs text-gray-700">+ Impuesto</button></div>
        <div className="space-y-2">{data.impuestos.map((tax, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-5"><select value={tax.tipo} onChange={(event) => updateTax(index, { tipo: event.target.value as FacturaImpuestoDraft["tipo"] })} className="rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="IVA">IVA</option><option value="RECARGO_EQUIVALENCIA">Recargo equivalencia</option><option value="IRPF">IRPF</option></select><Input label="%" type="number" value={tax.porcentaje} onChange={(value) => updateTax(index, { porcentaje: value })} /><Input label="Base" type="number" value={tax.baseImponible} onChange={(value) => updateTax(index, { baseImponible: value })} /><Input label="Cuota" type="number" value={tax.cuota} onChange={(value) => updateTax(index, { cuota: value })} /><button type="button" onClick={() => update("impuestos", data.impuestos.filter((_, itemIndex) => itemIndex !== index))} className="self-end pb-2 text-xs text-red-600">Eliminar</button></div>)}</div>
      </section>

      <section><h3 className="mb-2 text-sm font-semibold text-gray-900">Totales</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Input label="Total neto" type="number" value={data.totalNeto} onChange={(value) => update("totalNeto", value)} /><Input label="Total IVA" type="number" value={data.totalIva} onChange={(value) => update("totalIva", value)} /><Input label="Total recargo" type="number" value={data.totalRecargo} onChange={(value) => update("totalRecargo", value)} /><Input label="Total retenciones" type="number" value={data.totalRetenciones} onChange={(value) => update("totalRetenciones", value)} /><Input label="Importe total" type="number" value={data.importeTotal} onChange={(value) => update("importeTotal", value)} /></div></section>
      <Input label="Observaciones" value={data.observaciones} onChange={(value) => update("observaciones", value)} />
      {data.cifReceptor !== "B09711078" && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">CIF receptor incorrecto. Debe ser B09711078.</p>}
      <div className="flex gap-2"><button type="submit" disabled={missingRequired || saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Guardando..." : "Confirmar factura"}</button><button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm text-gray-700">Cancelar</button></div>
    </form>
  )
}
