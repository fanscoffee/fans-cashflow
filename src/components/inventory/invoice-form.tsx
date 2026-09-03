"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { emptyInvoiceDraft, emptyInvoiceLine, parseInvoiceText, type InvoiceDraft, type InvoiceTaxDraft, type InvoiceLineDraft } from "@/lib/invoice-ocr"
import { extractDocument } from "@/lib/document-ocr"
import { PaymentDocumentType, PaymentEntity, type DatabasePaymentDocumentType, type DatabasePaymentEntity } from "@/lib/database-enums"

interface Supplier { id: string; legalName: string; taxId: string; billingAddress?: string | null }
interface Product { id: string; code: string; posDescription: string; purchaseUnit: string | null; baseStockUnit: string }
interface DeliveryNote { id: string; deliveryNoteCode: string; receivedAt: string; lines: Array<{ productId: string; receivedQuantity: number | string; unitPrice: number | string; product: { code: string; posDescription: string; purchaseUnit: string | null } }> }

export interface InvoiceFormData extends InvoiceDraft {
  supplierId: string
  entity: DatabasePaymentEntity
  documentType: DatabasePaymentDocumentType
  invoiceFile: File | null
  confirmConAttachment: boolean
  existingAttachment: boolean
  confirmedAmount: string
  withheldAmount: string
  withholdingReason: string
  sourceReference: string
  paymentDate: string
  paymentStatus: "PENDIENTE"
  paidAmount: string
  receiptIds: string[]
  recipientTaxId: string
}

function createInitial(): InvoiceFormData {
  return {
    ...emptyInvoiceDraft(),
    supplierId: "",
    entity: PaymentEntity.BAKERY,
    documentType: PaymentDocumentType.MERCHANDISE_PURCHASE,
    invoiceFile: null,
    confirmConAttachment: true,
    existingAttachment: false,
    confirmedAmount: "",
    withheldAmount: "0",
    withholdingReason: "",
    sourceReference: "",
    paymentDate: "",
    paymentStatus: "PENDIENTE",
    paidAmount: "",
    receiptIds: [],
    recipientTaxId: "B09711078",
  }
}

interface MissingField {
  id: string
  section: string
  label: string
}

function getMissingRequiredFields(data: InvoiceFormData): MissingField[] {
  const missing: MissingField[] = []
  const add = (id: string, section: string, label: string) => missing.push({ id, section, label })

  if (!data.supplierId) add("factura-proveedor", "Identificación", "Proveedor")
  if (!data.number) add("factura-numero", "Identificación", "Número de factura")
  if (!data.issueDate) add("factura-fecha-expedicion", "Identificación", "Fecha de expedición")
  if (data.recipientTaxId !== "B09711078") add("factura-cif-receptor", "Identificación", "CIF receptor: debe ser B09711078")
  if (!data.issuerLegalName) add("factura-razon-social", "Emisor", "Razón social del emisor")
  if (!data.issuerTaxId) add("factura-nif-emisor", "Emisor", "NIF del emisor")
  if (!data.issuerBillingAddress) add("factura-domicilio-emisor", "Emisor", "Domicilio fiscal del emisor")
  if (data.confirmConAttachment && !data.invoiceFile && !data.existingAttachment) add("factura-adjunto", "Documento", "Adjunto PDF o imagen")

  if (data.lines.length === 0) {
    add("factura-lineas", "Líneas", "Al menos una línea de factura")
  } else {
    data.lines.forEach((line, index) => {
      const lineNumber = index + 1
      if (line.lineType === "PRODUCTO" && !line.productId) add(`factura-linea-${index}-producto`, "Líneas", `Línea ${lineNumber}: producto`)
      if (!line.description) add(`factura-linea-${index}-descripcion`, "Líneas", `Línea ${lineNumber}: descripción`)
      if (line.quantity === "") add(`factura-linea-${index}-cantidad`, "Líneas", `Línea ${lineNumber}: cantidad`)
    })
  }

  return missing
}

function Input({ id, label, value, onChange, type = "text", required = false, error = false }: { id?: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; error?: boolean }) {
  return <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">{label}{required ? " *" : ""}</span><input id={id} aria-invalid={error || undefined} type={type} step={type === "number" ? "0.0001" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} /></label>
}

function ProductCombobox({ id, products, selectedProduct, value, onSelect, error = false }: { id?: string; products: Product[]; selectedProduct?: Product; value: string; onSelect: (productId: string) => void; error?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = products.find((product) => product.id === value) || selectedProduct
  const options = selected && !products.some((product) => product.id === selected.id) ? [selected, ...products] : products
  const filtered = options.filter((product) => {
    const query = search.toLowerCase().trim()
    return !query || product.code.toLowerCase().includes(query) || product.posDescription.toLowerCase().includes(query)
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

  function handleSelect(productId: string) {
    onSelect(productId)
    setOpen(false)
    setSearch("")
  }

  return <div ref={containerRef} className="relative w-full">
    <input id={id} type="text" role="combobox" readOnly value={selected ? `${selected.code} - ${selected.posDescription}` : ""} title={selected ? `${selected.code} - ${selected.posDescription}` : undefined} placeholder="Buscar producto..." onFocus={() => setOpen(true)} onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="listbox" aria-controls={id ? `${id}-options` : undefined} aria-invalid={error || undefined} className={`w-full min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"}`} />
    {open && <div id={id ? `${id}-options` : undefined} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
      <div className="sticky top-0 bg-white p-1">
        <input type="text" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); setSearch("") } }} placeholder="Escribir para filtrar..." className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-gray-500">Sin resultados</div> : filtered.map((product) => <button key={product.id} type="button" role="option" aria-selected={product.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelect(product.id)} className={`block w-full px-2 py-1 text-left text-xs hover:bg-blue-50 ${product.id === value ? "bg-blue-100 font-medium" : ""}`}><span className="font-mono">{product.code}</span>{" "}<span className="text-gray-600">{product.posDescription}</span></button>)}
    </div>}
  </div>
}

export default function InvoiceForm({ initialValues, invoiceId, onCancel, onSubmit, saving }: { initialValues?: InvoiceFormData; invoiceId?: string; onCancel: () => void; onSubmit: (data: InvoiceFormData) => Promise<boolean>; saving: boolean }) {
  const [data, setData] = useState<InvoiceFormData>(initialValues || createInitial())
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
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
      setSuppliers(providerData.suppliers || [])
      setProducts(productData.products || [])
    }).catch(() => setOcrError("No se pudieron cargar catálogos"))
  }, [])

  useEffect(() => {
    if (!data.supplierId) { setDeliveryNotes([]); return }
    const params = new URLSearchParams({ supplierId: data.supplierId })
    if (invoiceId) params.set("invoiceId", invoiceId)
    fetch(`/api/inventario/facturas/albaranes?${params}`)
      .then((response) => response.json())
      .then((result) => setDeliveryNotes(result.deliveryNotes || []))
      .catch(() => setDeliveryNotes([]))
  }, [data.supplierId, invoiceId])
  /* eslint-enable react-hooks/set-state-in-effect */

  function update<K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) {
    setData((current) => ({ ...current, [field]: value }))
  }

  async function handleFile(file: File) {
    setOcrError("")
    setOcrStatus("Procesando documento...")
    const pdfCandidate = file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    try {
      const text = await extractDocument(file, setOcrStatus)
      if (!text.trim()) throw new Error("El documento no contiene texto legible")
      const draft = parseInvoiceText(text)
       setData((current) => ({ ...current, ...draft, invoiceFile: file, recipientTaxId: draft.validRecipientTaxId ? "B09711078" : "" }))
       const provider = suppliers.find((item) => item.taxId.replace(/[\s.-]/g, "").toUpperCase() === draft.issuerTaxId.replace(/[\s.-]/g, "").toUpperCase())
       if (provider) setData((current) => ({ ...current, ...draft, invoiceFile: file, supplierId: provider.id, recipientTaxId: draft.validRecipientTaxId ? "B09711078" : "" }))
      setDocumentRead(true)
      setOcrStatus("Documento leído. Revisa datos y confirma.")
    } catch {
      setOcrError(pdfCandidate ? "No se pudo leer el PDF. Comprueba que no esté protegido con contraseña o vuelve a descargarlo." : "No se pudo leer documento. Completa formulario manualmente.")
      setOcrStatus("")
    }
  }

  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    setData((current) => ({ ...current, lines: current.lines.map((line, itemIndex) => itemIndex === index ? { ...line, ...patch } : line) }))
  }

  function addLine(lineType: "PRODUCTO" | "CARGO" = "PRODUCTO") {
    const line = emptyInvoiceLine()
    line.lineType = lineType
    setData((current) => ({ ...current, lines: [...current.lines, line] }))
  }

  function updateTax(index: number, patch: Partial<InvoiceTaxDraft>) {
    setData((current) => ({ ...current, taxes: current.taxes.map((tax, itemIndex) => itemIndex === index ? { ...tax, ...patch } : tax) }))
  }

  const availableProducts = useMemo(() => {
    const linkedProductIds = new Set(deliveryNotes.filter((deliveryNote) => data.receiptIds.includes(deliveryNote.id)).flatMap((deliveryNote) => deliveryNote.lines.map((line) => line.productId)))
    return data.receiptIds.length ? products.filter((product) => linkedProductIds.has(product.id)) : products
  }, [deliveryNotes, data.receiptIds, products])
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
           {data.existingAttachment && !data.invoiceFile && <span className="text-xs text-green-800">Adjunto existente</span>}
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
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Proveedor *</span><select id="factura-proveedor" aria-invalid={missingFieldIds.has("factura-proveedor") || undefined} value={data.supplierId} onChange={(event) => { const provider = suppliers.find((item) => item.id === event.target.value); update("supplierId", event.target.value); if (provider) setData((current) => ({ ...current, issuerLegalName: provider.legalName, issuerTaxId: provider.taxId, issuerBillingAddress: provider.billingAddress || "" })) }} className={`w-full rounded-md border px-2 py-1.5 text-sm text-gray-900 ${missingFieldIds.has("factura-proveedor") ? "border-red-500 bg-red-50" : "border-gray-300"}`}><option value="">Seleccionar...</option>{suppliers.map((provider) => <option key={provider.id} value={provider.id}>{provider.legalName} — {provider.taxId}</option>)}</select></label>
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Entidad *</span><select value={data.entity} onChange={(event) => update("entity", event.target.value as InvoiceFormData["entity"])} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"><option value={PaymentEntity.BAKERY}>Obrador</option><option value={PaymentEntity.COFFEE_SHOP}>Cafetería</option></select></label>
           <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Tipo *</span><select value={data.documentType} onChange={(event) => update("documentType", event.target.value as InvoiceFormData["documentType"])} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"><option value={PaymentDocumentType.MERCHANDISE_PURCHASE}>Compra mercancía</option><option value={PaymentDocumentType.EXPENSE}>Gasto</option></select></label>
          <Input label="Serie" value={data.series} onChange={(value) => update("series", value)} />
          <Input id="factura-numero" label="Número factura" value={data.number} onChange={(value) => update("number", value)} required error={missingFieldIds.has("factura-numero")} />
          <Input id="factura-fecha-expedicion" label="Fecha expedición" type="date" value={data.issueDate} onChange={(value) => update("issueDate", value)} required error={missingFieldIds.has("factura-fecha-expedicion")} />
          <Input label="Fecha operación" type="date" value={data.operationDate} onChange={(value) => update("operationDate", value)} />
          <Input label="Vencimiento" type="date" value={data.dueDate} onChange={(value) => update("dueDate", value)} />
          <Input label="Fecha pago" type="date" value={data.paymentDate} onChange={(value) => update("paymentDate", value)} />
          <Input label="Nº pedido" value={data.orderNumber} onChange={(value) => update("orderNumber", value)} />
          <Input label="Fecha pedido" type="date" value={data.orderDate} onChange={(value) => update("orderDate", value)} />
          <Input label="Centro entrega" value={data.deliveryCenter} onChange={(value) => update("deliveryCenter", value)} />
          <Input label="Referencia albarán" value={data.deliveryNoteReference} onChange={(value) => update("deliveryNoteReference", value)} />
          <Input label="Fecha albarán" type="date" value={data.deliveryNoteDate} onChange={(value) => update("deliveryNoteDate", value)} />
          <Input label="Forma de pago" value={data.paymentMethod} onChange={(value) => update("paymentMethod", value)} />
          <Input label="Importe pagado" type="number" value={data.paidAmount} onChange={(value) => update("paidAmount", value)} />
          <Input id="factura-cif-receptor" label="CIF receptor" value={data.recipientTaxId} onChange={(value) => update("recipientTaxId", value.toUpperCase())} required error={missingFieldIds.has("factura-cif-receptor")} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Emisor</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input id="factura-razon-social" label="Razón social" value={data.issuerLegalName} onChange={(value) => update("issuerLegalName", value)} required error={missingFieldIds.has("factura-razon-social")} />
          <Input id="factura-nif-emisor" label="NIF" value={data.issuerTaxId} onChange={(value) => update("issuerTaxId", value.toUpperCase())} required error={missingFieldIds.has("factura-nif-emisor")} />
          <Input id="factura-domicilio-emisor" label="Domicilio fiscal" value={data.issuerBillingAddress} onChange={(value) => update("issuerBillingAddress", value)} required error={missingFieldIds.has("factura-domicilio-emisor")} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">Albaranes vinculados</h3><span className="text-xs text-gray-500">Solo albaranes libres del proveedor</span></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {deliveryNotes.map((deliveryNote) => <label key={deliveryNote.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs hover:bg-gray-50"><input type="checkbox" checked={data.receiptIds.includes(deliveryNote.id)} onChange={(event) => update("receiptIds", event.target.checked ? [...data.receiptIds, deliveryNote.id] : data.receiptIds.filter((id) => id !== deliveryNote.id))} className="mt-0.5" /><span><strong>{deliveryNote.deliveryNoteCode}</strong> — {new Date(deliveryNote.receivedAt).toLocaleDateString("es-ES")} — {deliveryNote.lines.length} líneas</span></label>)}
          {data.supplierId && deliveryNotes.length === 0 && <p className="text-xs text-gray-500">No hay albaranes libres para este proveedor.</p>}
        </div>
      </section>

      <section id="factura-lineas">
         <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-gray-900">Líneas</h3><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" onClick={() => addLine("PRODUCTO")} className="min-h-11 rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:py-1">+ Producto</button><button type="button" onClick={() => addLine("CARGO")} className="min-h-11 rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:py-1">+ Cargo</button></div></div>
        <div className="space-y-3">
          {data.lines.map((line, index) => <div key={`${index}-${line.supplierReference}`} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block text-xs text-gray-600"><span className="mb-1 block font-medium">Tipo</span><select value={line.lineType} onChange={(event) => updateLine(index, { lineType: event.target.value as "PRODUCTO" | "CARGO" })} className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="PRODUCTO">Producto</option><option value="CARGO">Cargo</option></select></label>
              {line.lineType === "PRODUCTO" ? <label className="block text-xs text-gray-600 sm:col-span-2"><span className="mb-1 block font-medium">Producto *</span><ProductCombobox id={`factura-linea-${index}-producto`} products={availableProducts} selectedProduct={products.find((product) => product.id === line.productId)} value={line.productId} onSelect={(productId) => { const product = products.find((item) => item.id === productId); updateLine(index, { productId, description: product?.posDescription || line.description, unitOfMeasure: product?.purchaseUnit || line.unitOfMeasure }) }} error={missingFieldIds.has(`factura-linea-${index}-producto`)} /></label> : <Input label="Descripción cargo" value={line.description} onChange={(value) => updateLine(index, { description: value })} required error={missingFieldIds.has(`factura-linea-${index}-descripcion`)} />}
               <Input label="Ref. proveedor" value={line.supplierReference} onChange={(value) => updateLine(index, { supplierReference: value })} />
               <Input label="Código artículo" value={line.itemCode} onChange={(value) => updateLine(index, { itemCode: value })} />
               <Input id={`factura-linea-${index}-descripcion`} label="Descripción" value={line.description} onChange={(value) => updateLine(index, { description: value })} required error={missingFieldIds.has(`factura-linea-${index}-descripcion`)} />
              <Input label="U.Medida" value={line.unitOfMeasure} onChange={(value) => updateLine(index, { unitOfMeasure: value })} />
              <Input label="Formato original" value={line.originalFormat} onChange={(value) => updateLine(index, { originalFormat: value })} />
              <Input id={`factura-linea-${index}-cantidad`} label="Cantidad" type="number" value={line.quantity} onChange={(value) => updateLine(index, { quantity: value })} required error={missingFieldIds.has(`factura-linea-${index}-cantidad`)} />
              <Input label="Descuento %" type="number" value={line.discountPercentage} onChange={(value) => updateLine(index, { discountPercentage: value })} />
              <Input label="Descuento importe" type="number" value={line.discountAmount} onChange={(value) => updateLine(index, { discountAmount: value })} />
              <Input label="Precio unitario" type="number" value={line.unitPrice} onChange={(value) => updateLine(index, { unitPrice: value })} />
              <Input label="Precio unitario neto" type="number" value={line.netUnitPrice} onChange={(value) => updateLine(index, { netUnitPrice: value })} />
              <Input label="Base imponible" type="number" value={line.taxableBase} onChange={(value) => updateLine(index, { taxableBase: value })} />
              <Input label="IVA %" type="number" value={line.vatRate} onChange={(value) => updateLine(index, { vatRate: value })} />
              <Input label="Cuota IVA" type="number" value={line.vatAmount} onChange={(value) => updateLine(index, { vatAmount: value })} />
              <Input label="Total línea" type="number" value={line.lineTotal} onChange={(value) => updateLine(index, { lineTotal: value })} />
              <Input label="Lote" value={line.batch} onChange={(value) => updateLine(index, { batch: value })} />
              <Input label="Caducidad" type="date" value={line.dueDate} onChange={(value) => updateLine(index, { dueDate: value })} />
            </div>
            <button type="button" onClick={() => setData((current) => ({ ...current, lines: current.lines.filter((_, itemIndex) => itemIndex !== index) }))} className="mt-2 text-xs text-red-600">Eliminar línea</button>
          </div>)}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-semibold text-gray-900">Impuestos</h3><button type="button" onClick={() => update("taxes", [...data.taxes, { type: "IVA", percentage: "0", taxableBase: "0", taxAmount: "0" }])} className="min-h-11 w-full rounded-md border px-2 py-2 text-xs text-gray-700 sm:min-h-0 sm:w-auto sm:py-1">+ Impuesto</button></div>
        <div className="space-y-2">{data.taxes.map((tax, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-5"><select value={tax.type} onChange={(event) => updateTax(index, { type: event.target.value as InvoiceTaxDraft["type"] })} className="rounded-md border px-2 py-1.5 text-sm text-gray-900"><option value="IVA">IVA</option><option value="RECARGO_EQUIVALENCIA">Recargo equivalencia</option><option value="IRPF">IRPF</option></select><Input label="%" type="number" value={tax.percentage} onChange={(value) => updateTax(index, { percentage: value })} /><Input label="Base" type="number" value={tax.taxableBase} onChange={(value) => updateTax(index, { taxableBase: value })} /><Input label="Cuota" type="number" value={tax.taxAmount} onChange={(value) => updateTax(index, { taxAmount: value })} /><button type="button" onClick={() => update("taxes", data.taxes.filter((_, itemIndex) => itemIndex !== index))} className="self-end pb-2 text-xs text-red-600">Eliminar</button></div>)}</div>
      </section>

        <section><h3 className="mb-2 text-sm font-semibold text-gray-900">Totales</h3><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-5"><Input label="Total neto" type="number" value={data.netTotal} onChange={(value) => update("netTotal", value)} /><Input label="Total descuento" type="number" value={data.discountTotal} onChange={(value) => update("discountTotal", value)} /><Input label="Total IVA" type="number" value={data.totalVat} onChange={(value) => update("totalVat", value)} /><Input label="Total recargo" type="number" value={data.surchargeTotal} onChange={(value) => update("surchargeTotal", value)} /><Input label="Total retenciones" type="number" value={data.withholdingTotal} onChange={(value) => update("withholdingTotal", value)} /><Input label="Importe total" type="number" value={data.totalAmount} onChange={(value) => update("totalAmount", value)} /></div></section>
      <Input label="Observaciones" value={data.notes} onChange={(value) => update("notes", value)} />
      {data.recipientTaxId !== "B09711078" && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">CIF receptor incorrecto. Debe ser B09711078.</p>}
        <div className="flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={missingRequired || saving} className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto">{saving ? "Guardando..." : missingRequired ? `Faltan ${missingFields.length} campos` : "Confirmar factura"}</button><button type="button" onClick={onCancel} className="w-full rounded-md border px-4 py-2 text-sm text-gray-700 sm:w-auto">Cancelar</button></div>
    </form>
  )
}
