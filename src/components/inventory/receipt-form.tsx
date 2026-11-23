"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { calculateVatInclusiveAmount } from "@/lib/product-pricing"
import { GENERIC_RECEIPT_PRODUCT_LABEL, GENERIC_RECEIPT_UNIT, receptionLineSchema } from "@/lib/reception-input"
import { extractDocument } from "@/lib/document-ocr"
import {
  grossAmountToNet,
  grossLineTotalToNetUnitPrice,
  matchDeliveryProduct,
  parseDeliveryNoteText,
  validateDeliveryNoteFiscalBreakdown,
  type DeliveryNoteLineDraft,
  type DeliveryNoteTaxDraft,
} from "@/lib/delivery-note-ocr"
import ProductCombobox from "@/components/inventory/product-combobox"

interface Supplier {
  id: string
  legalName: string
  taxId?: string
}

interface Product {
  id: string
  code: string
  posDescription: string
  purchaseUnit: string
  isWeightBased?: boolean
  baseUnitCost: number | string | null
  purchaseVatPercentage: number | string | null
  vatPercentage: number | string | null
}

type SupplierCatalog = { supplierId: string; products: Product[] }

const EMPTY_PRODUCTS: Product[] = []
const genericProductOption = { id: "__generic_receipt_product__", code: "", posDescription: GENERIC_RECEIPT_PRODUCT_LABEL }

const receiptSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor"),
  deliveryNoteCode: z.string().min(1, "El código de albarán es obligatorio"),
  receivedAt: z.string().min(1, "La fecha es obligatoria"),
  notes: z.string().optional(),
  transportCost: z.coerce.number().finite().nonnegative("El transporte no puede ser negativo"),
  lines: z
    .array(receptionLineSchema)
    .min(1, "Agrega al menos una línea de producto")
    .max(500),
})

export type ReceiptFormValues = z.infer<typeof receiptSchema>
type ReceiptFormLine = ReceiptFormValues["lines"][number]

function lineVatPercentage(line?: ReceiptFormLine, product?: Product) {
  return line?.productId === null
    ? line.genericVatPercentage
    : product?.purchaseVatPercentage ?? product?.vatPercentage
}

function unitPriceIncludingVat(line?: ReceiptFormLine, product?: Product) {
  return calculateVatInclusiveAmount({
    amount: line?.unitPrice,
    vatPercentage: lineVatPercentage(line, product),
  }) ?? 0
}

function todayString() {
  return new Date().toISOString().split("T")[0]
}

function defaultReceiptValues(): ReceiptFormValues {
  return {
    supplierId: "",
    deliveryNoteCode: "",
    receivedAt: todayString(),
    notes: "",
    transportCost: 0,
    lines: [{ productId: "", receivedQuantity: 1, packageCount: 1, unitPrice: 0, batch: "", dueDate: "" }],
  }
}

export default function ReceiptForm({
  onSubmit,
  onCancel,
  saving,
  initialValues,
}: {
  onSubmit: (data: ReceiptFormValues) => Promise<void>
  onCancel: () => void
  saving: boolean
  initialValues?: ReceiptFormValues
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalog, setCatalog] = useState<SupplierCatalog | null>(null)
  const catalogRef = useRef<SupplierCatalog | null>(null)
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrError, setOcrError] = useState("")
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([])
  const [ocrUnmatched, setOcrUnmatched] = useState<number | null>(null)
  const [documentRead, setDocumentRead] = useState(false)
  const [ocrReviewed, setOcrReviewed] = useState(false)
  const [hasPendingOcrLines, setHasPendingOcrLines] = useState(false)
  const pendingOcrLinesRef = useRef<DeliveryNoteLineDraft[] | null>(null)
  const [ocrLineDetails, setOcrLineDetails] = useState<Array<{ description: string; grossTotal: number } | null>>([])
  const [ocrTaxes, setOcrTaxes] = useState<DeliveryNoteTaxDraft[]>([])
  const [ocrPreparationGross, setOcrPreparationGross] = useState<number | null>(null)
  const [ocrTotalGross, setOcrTotalGross] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema) as Resolver<ReceiptFormValues>,
    defaultValues: initialValues || defaultReceiptValues(),
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "lines",
  })

  const supplierId = useWatch({ control, name: "supplierId" })
  const lines = useWatch({ control, name: "lines" })
  const transportCost = Number(useWatch({ control, name: "transportCost" }) || 0)
  const supplierField = register("supplierId")
  const products = catalog?.supplierId === supplierId ? catalog.products : EMPTY_PRODUCTS
  const productOptions = useMemo(() => [genericProductOption, ...products], [products])

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  const applyOcrLines = useCallback((draft: DeliveryNoteLineDraft[], catalogProducts: Product[]) => {
    const mappedLines = draft.map((line) => {
      const product = matchDeliveryProduct(line.description, catalogProducts)
      const quantity = Number(line.quantity)
      const grossTotal = Number(line.lineTotal)
      return {
        productId: product?.id || "",
        receivedQuantity: quantity > 0 ? quantity : 1,
        packageCount: 1,
        unitPrice: product
          ? grossLineTotalToNetUnitPrice(grossTotal, quantity, product.purchaseVatPercentage ?? product.vatPercentage)
          : quantity > 0 ? Number((grossTotal / quantity).toFixed(4)) : 0,
        batch: "",
        dueDate: "",
      }
    })
    const unmatched = mappedLines.filter((line) => !line.productId).length
    replace(mappedLines)
    setOcrUnmatched(unmatched)
    pendingOcrLinesRef.current = null
    setHasPendingOcrLines(false)
  }, [replace])

  useEffect(() => {
    if (!supplierId) return

    const controller = new AbortController()
    const params = new URLSearchParams({ supplierId })
    fetch(`/api/inventario/recepciones/productos?${params}`, { signal: controller.signal })
      .then(async (response): Promise<Product[]> => {
        if (!response.ok) return []
        const data = await response.json() as { products?: Product[] }
        return data.products || []
      })
      .catch(() => [])
      .then((loadedProducts) => {
        if (controller.signal.aborted || getValues("supplierId") !== supplierId) return
        const loadedCatalog = { supplierId, products: loadedProducts }
        catalogRef.current = loadedCatalog
        setCatalog(loadedCatalog)
        if (pendingOcrLinesRef.current) applyOcrLines(pendingOcrLinesRef.current, loadedProducts)
      })

    return () => controller.abort()
  }, [applyOcrLines, getValues, supplierId])

  function changeSupplier(clearProductLines: boolean) {
    catalogRef.current = null
    setCatalog(null)
    if (!clearProductLines || pendingOcrLinesRef.current) return

    getValues("lines").forEach((line, index) => {
      if (line.productId === null) return
      setValue(`lines.${index}.productId`, "")
      setValue(`lines.${index}.unitPrice`, 0)
      setValue(`lines.${index}.packageCount`, 1)
      setValue(`lines.${index}.batch`, "")
      setValue(`lines.${index}.dueDate`, "")
    })
  }

  const handleAddLine = () => {
    append({ productId: "", receivedQuantity: 1, packageCount: 1, unitPrice: 0, batch: "", dueDate: "" })
    setOcrLineDetails((current) => [...current, null])
  }

  const handleProductChange = (index: number, optionId: string) => {
    const productId = optionId === genericProductOption.id ? null : optionId
    const previousProductId = getValues(`lines.${index}.productId`)
    if (previousProductId === productId) return
    const imported = ocrLineDetails[index]
    const product = products.find((candidate) => candidate.id === productId)
    clearErrors(`lines.${index}`)
    setValue(`lines.${index}.productId`, productId)
    setValue(`lines.${index}.genericDescription`, productId === null ? imported?.description.slice(0, 500) || "" : null)
    setValue(`lines.${index}.genericVatPercentage`, null)
    setValue(`lines.${index}.packageCount`, 1)
    if (imported) {
      const quantity = Number(getValues(`lines.${index}.receivedQuantity`))
      setValue(`lines.${index}.unitPrice`, grossLineTotalToNetUnitPrice(imported.grossTotal, quantity, product?.purchaseVatPercentage ?? product?.vatPercentage))
    } else if (product?.baseUnitCost != null) {
      setValue(`lines.${index}.unitPrice`, Number(product.baseUnitCost))
    } else if (previousProductId === null || (previousProductId && productId === null)) {
      setValue(`lines.${index}.unitPrice`, 0)
    }
  }

  function updateGenericOcrPrice(index: number, value: string) {
    const imported = ocrLineDetails[index]
    const vat = Number(value)
    if (!imported || value === "" || !Number.isFinite(vat) || vat < 0 || vat > 100) return
    const quantity = Number(getValues(`lines.${index}.receivedQuantity`))
    setValue(`lines.${index}.unitPrice`, grossLineTotalToNetUnitPrice(imported.grossTotal, quantity, vat))
  }

  async function handleFile(file: File) {
    setOcrError("")
    setOcrWarnings([])
    setOcrUnmatched(null)
    setOcrReviewed(false)
    setDocumentRead(false)
    pendingOcrLinesRef.current = null
    setHasPendingOcrLines(false)
    setOcrLineDetails([])
    setOcrTaxes([])
    setOcrPreparationGross(null)
    setOcrTotalGross(null)
    setOcrStatus("Procesando albarán...")
    try {
      const text = await extractDocument(file, setOcrStatus, "spa+eng")
      const draft = parseDeliveryNoteText(text)
      let availableSuppliers = suppliers
      if (availableSuppliers.length === 0) {
        const response = await fetch("/api/inventario/proveedores?pageSize=100")
        if (response.ok) {
          const result = await response.json() as { suppliers?: Supplier[] }
          availableSuppliers = result.suppliers || []
          setSuppliers(availableSuppliers)
        }
      }

      const normalizedTaxId = (draft.supplierTaxId || "").replace(/[\s./-]/g, "").toUpperCase()
      const normalizedName = draft.supplierName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      const findSupplier = (options: Supplier[]) => options.find((candidate) => {
        const candidateTaxId = (candidate.taxId || "").replace(/[\s./-]/g, "").toUpperCase()
        const candidateName = candidate.legalName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        return Boolean(normalizedTaxId && candidateTaxId === normalizedTaxId) || Boolean(normalizedName && (candidateName.includes(normalizedName) || normalizedName.includes(candidateName)))
      })
      let supplier = findSupplier(availableSuppliers)
      if (!supplier && (normalizedTaxId || normalizedName)) {
        const search = encodeURIComponent(draft.supplierTaxId || draft.supplierName)
        const response = await fetch(`/api/inventario/proveedores?search=${search}&pageSize=100`)
        if (response.ok) {
          const result = await response.json() as { suppliers?: Supplier[] }
          const searchedSuppliers = result.suppliers || []
          supplier = findSupplier(searchedSuppliers)
          if (searchedSuppliers.length > 0) setSuppliers((current) => Array.from(new Map([...current, ...searchedSuppliers].map((candidate) => [candidate.id, candidate])).values()))
        }
      }

      const nextSupplierId = supplier?.id || ""
      const currentSupplierId = getValues("supplierId")
      if (nextSupplierId !== currentSupplierId) {
        changeSupplier(Boolean(currentSupplierId) && draft.lines.length === 0)
        setValue("supplierId", nextSupplierId)
      }
      setValue("deliveryNoteCode", draft.deliveryNoteCode)
      setValue("receivedAt", draft.receivedAt)
      const preparationGross = Number(draft.preparationGross)
      const preparationVat = draft.taxes.find((tax) => Number(tax.percentage) === 21)?.percentage
      const preparationNet = preparationGross > 0 && preparationVat !== undefined
        ? grossAmountToNet(preparationGross, preparationVat) ?? preparationGross
        : preparationGross
      setValue("transportCost", preparationNet)
      setOcrPreparationGross(Number.isFinite(preparationGross) ? preparationGross : null)
      setOcrTotalGross(Number.isFinite(Number(draft.totalAmount)) ? Number(draft.totalAmount) : null)
      setOcrTaxes(draft.taxes)
      if (!getValues("notes")) setValue("notes", `Importado por OCR · ${draft.supplierName || "proveedor no identificado"}`)

      if (draft.lines.length > 0) {
        setOcrLineDetails(draft.lines.map((line) => ({ description: line.description, grossTotal: Number(line.lineTotal) })))
        const loadedCatalog = catalogRef.current
        if (loadedCatalog?.supplierId === nextSupplierId) {
          applyOcrLines(draft.lines, loadedCatalog.products)
        } else {
          replace(draft.lines.map((line) => ({
            productId: "",
            receivedQuantity: Number(line.quantity) || 1,
            packageCount: 1,
            unitPrice: Number(line.lineTotal) / (Number(line.quantity) || 1),
            batch: "",
            dueDate: "",
          })))
          pendingOcrLinesRef.current = draft.lines
          setHasPendingOcrLines(true)
        }
      }

      const warnings = [...draft.warnings]
      if (!supplier) warnings.push("Selecciona manualmente el proveedor para poder asociar los productos")
      if (preparationGross > 0 && preparationVat === undefined) warnings.push("No se ha podido convertir el coste de preparación: falta confirmar un IVA del 21%")
      if (draft.lines.length > 0 && draft.taxes.length === 0) warnings.push("No se encontró el desglose de IVA del albarán")
      setOcrWarnings(Array.from(new Set(warnings)))
      setDocumentRead(true)
      setOcrStatus(supplier ? "Albarán leído. Revisa y confirma las líneas antes de guardar." : "Albarán leído con revisión pendiente.")
    } catch (reason) {
      setOcrError(reason instanceof Error ? reason.message : "No se pudo leer el albarán")
      setOcrStatus("")
      setDocumentRead(false)
    }
  }

  async function handleFormSubmit(data: ReceiptFormValues) {
    if (documentRead) {
      const fiscalWarnings = ocrFiscalValidation?.warnings || ["La validación fiscal del albarán aún no está completa"]
      if (!ocrReviewed || fiscalWarnings.length > 0) {
        setOcrWarnings((current) => Array.from(new Set([...current, ...fiscalWarnings])))
        setOcrStatus(!ocrReviewed
          ? "Marca que has revisado el albarán antes de guardar."
          : "Corrige las diferencias fiscales antes de guardar la recepción.")
        return
      }
    }
    await onSubmit(data)
  }

  const getProductInfo = (productId: string | null) => {
    return products.find((p) => p.id === productId)
  }

  const productsTotal = (lines || []).reduce((sum, l) => {
    const product = getProductInfo(l.productId)
    return sum + Number(l.receivedQuantity || 0) * unitPriceIncludingVat(l, product)
  }, 0)
  const weightedPackageCount = (lines || []).reduce((sum, line) => {
    const product = getProductInfo(line.productId)
    return sum + (product?.isWeightBased ? Number(line.packageCount || 0) : 0)
  }, 0)
  const ocrFiscalValidation = documentRead
    ? validateDeliveryNoteFiscalBreakdown({
        lines: (lines || []).map((line, index) => ({
          quantity: line.receivedQuantity,
          netUnitPrice: line.unitPrice,
          vatPercentage: lineVatPercentage(line, getProductInfo(line.productId)),
          grossLineTotal: ocrLineDetails[index]?.grossTotal,
        })),
        taxes: ocrTaxes,
        preparationGross: ocrPreparationGross,
        preparationNet: transportCost,
        totalGross: ocrTotalGross,
      })
    : null
  const transportGross = ocrPreparationGross ?? transportCost
  const totalReceipt = productsTotal + transportGross
  const unassignedOcrLines = hasPendingOcrLines
    ? 0
    : (lines || []).filter((line, index) => ocrLineDetails[index] && line.productId === "").length
  const productOptionsLoading = catalog?.supplierId !== supplierId || hasPendingOcrLines
  const productPlaceholder = !supplierId
    ? "Selecciona primero un proveedor..."
    : productOptionsLoading
      ? "Cargando productos..."
      : "Buscar producto..."

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Leer foto / PDF del albarán</button>
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void handleFile(file) }} />
          {documentRead && <span className="text-xs font-medium text-green-800">Documento leído</span>}
        </div>
        <p className="mt-1 text-xs text-blue-800">OCR local. Revisa proveedor, productos, cantidades y precios antes de registrar la recepción.</p>
        {ocrStatus && <p className="mt-1 text-xs text-blue-800">{ocrStatus}</p>}
        {ocrError && <p className="mt-1 text-xs text-red-700">{ocrError}</p>}
        {ocrTaxes.length > 0 && (
          <div className="mt-2 rounded border border-blue-200 bg-white p-2 text-xs text-gray-700">
            <p className="font-semibold text-gray-900">Desglose fiscal del albarán</p>
            {ocrTaxes.map((tax) => <p key={tax.percentage}>{Number(tax.percentage).toFixed(0)}% · base {Number(tax.taxableBase).toFixed(2)} EUR · cuota {Number(tax.taxAmount).toFixed(2)} EUR</p>)}
            {ocrFiscalValidation && <p className="mt-1 text-gray-500">Calculado: {ocrFiscalValidation.calculatedTaxes.map((tax) => `${Number(tax.percentage).toFixed(0)}% base ${Number(tax.taxableBase).toFixed(2)} / cuota ${Number(tax.taxAmount).toFixed(2)}`).join(" · ")}</p>}
          </div>
        )}
        {ocrWarnings.length > 0 && <div className="mt-2 space-y-1 text-xs text-amber-800">{ocrWarnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}
        {ocrFiscalValidation?.warnings.length ? (
          <div className="mt-2 space-y-1 text-xs text-red-700">
            {ocrFiscalValidation.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}
          </div>
        ) : null}
        {documentRead && ocrFiscalValidation && !ocrFiscalValidation.warnings.length && ocrTaxes.length > 0 && (
          <p className="mt-2 text-xs text-green-800">El desglose de IVA coincide con las bases y cuotas del albarán.</p>
        )}
        {ocrUnmatched !== null && ocrUnmatched === 0 && <p className="mt-2 text-xs text-green-800">Todas las líneas se asociaron automáticamente al catálogo del proveedor.</p>}
        {unassignedOcrLines > 0 && <p className="mt-2 text-xs text-amber-800">Líneas pendientes de asignar: {unassignedOcrLines}. Selecciona un producto del catálogo o {GENERIC_RECEIPT_PRODUCT_LABEL}.</p>}
        {documentRead && (
          <label className="mt-3 flex items-start gap-2 text-xs text-blue-900">
            <input type="checkbox" checked={ocrReviewed} onChange={(event) => setOcrReviewed(event.currentTarget.checked)} className="mt-0.5" />
            <span>He revisado proveedor, productos, cantidades, IVA, precios y totales antes de guardar.</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="recepcion-proveedor" className="mb-1 block text-sm font-medium text-gray-700">
            Proveedor *
          </label>
          <select
            id="recepcion-proveedor"
            {...supplierField}
            onChange={(event) => {
              if (event.currentTarget.value !== supplierId) changeSupplier(Boolean(supplierId))
              void supplierField.onChange(event)
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Seleccionar proveedor...</option>
            {suppliers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.legalName}
              </option>
            ))}
          </select>
          {errors.supplierId && (
            <p className="mt-1 text-xs text-red-600">{errors.supplierId.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Código de Albarán *
          </label>
          <input
            type="text"
            {...register("deliveryNoteCode")}
            placeholder="Ej: ALB-2026-00123"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.deliveryNoteCode && (
            <p className="mt-1 text-xs text-red-600">{errors.deliveryNoteCode.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Fecha de Recepción *
          </label>
          <input
            type="date"
            {...register("receivedAt")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.receivedAt && (
            <p className="mt-1 text-xs text-red-600">{errors.receivedAt.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notas
          </label>
          <input
            type="text"
            {...register("notes")}
            placeholder="Observaciones opcionales..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="recepcion-transporte" className="mb-1 block text-sm font-medium text-gray-700">
            Importe de transporte/preparación sin IVA
          </label>
          <input
            id="recepcion-transporte"
            type="number"
            min="0"
            step="0.0001"
            {...register("transportCost")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
            <p className="mt-1 text-xs text-gray-500">Se guarda como coste sin IVA. Si se importa un albarán, el PVP bruto y su IVA se muestran para revisión.</p>
          {errors.transportCost && (
            <p className="mt-1 text-xs text-red-600">{errors.transportCost.message}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Líneas de Producto *</h3>
        <p className="mb-3 text-xs text-gray-500">Añade una tarjeta por cada producto del albarán. Para compras puntuales fuera del catálogo, selecciona {GENERIC_RECEIPT_PRODUCT_LABEL}.</p>

        {errors.lines && (
          <p className="mb-2 text-xs text-red-600">{errors.lines.message || errors.lines.root?.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const line = lines?.[index]
            const isGeneric = line?.productId === null
            const prod = getProductInfo(line?.productId ?? null)
            const lineErrors = errors.lines?.[index]
            const unitPriceWithoutVat = Number(line?.unitPrice || 0)
            const unitPriceWithVat = unitPriceIncludingVat(line, prod)
            const quantity = Number(line?.receivedQuantity || 0)
            const subtotalWithoutVat = quantity * unitPriceWithoutVat
            const subtotal = quantity * unitPriceWithVat
            const vatPercentage = lineVatPercentage(line, prod)
            const isWeightBased = Boolean(prod?.isWeightBased)
            const grossLineTotal = ocrLineDetails[index]?.grossTotal
            const grossUnitPrice = grossLineTotal !== null && grossLineTotal !== undefined && quantity > 0
              ? grossLineTotal / quantity
              : unitPriceWithVat
            const productId = `recepcion-producto-${field.id}`
            const descriptionId = `recepcion-descripcion-${field.id}`
            const vatId = `recepcion-iva-${field.id}`
            const quantityId = `recepcion-cantidad-${field.id}`
            const priceId = `recepcion-precio-${field.id}`
            const batchId = `recepcion-lote-${field.id}`
            const dueDateId = `recepcion-vencimiento-${field.id}`

            return (
              <fieldset key={field.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-900">Producto {index + 1}</h4>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => { remove(index); setOcrLineDetails((current) => current.filter((_, lineIndex) => lineIndex !== index)) }}
                      aria-label={`Eliminar producto ${index + 1}`}
                      className="min-h-11 shrink-0 rounded-md px-3 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-800 sm:min-h-0"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor={productId} className="mb-1 block text-xs font-medium text-gray-600">
                      Producto *
                    </label>
                    <ProductCombobox
                      id={productId}
                      products={productOptions}
                      value={isGeneric ? genericProductOption.id : line?.productId || ""}
                      onSelect={(id) => handleProductChange(index, id)}
                      error={Boolean(lineErrors?.productId)}
                      disabled={!supplierId || productOptionsLoading}
                      placeholder={productPlaceholder}
                    />
                    {lineErrors?.productId && <p className="mt-1 text-xs text-red-600">{lineErrors.productId.message}</p>}
                  </div>

                  {isGeneric && (
                    <div>
                      <label htmlFor={descriptionId} className="mb-1 block text-xs font-medium text-gray-600">
                        Descripción del producto genérico *
                      </label>
                      <input
                        id={descriptionId}
                        type="text"
                        maxLength={500}
                        placeholder="Ej. Decoración de Halloween"
                        aria-invalid={Boolean(lineErrors?.genericDescription)}
                        {...register(`lines.${index}.genericDescription`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Se guarda solo en el albarán, sin añadirlo al catálogo ni al stock.</p>
                      {lineErrors?.genericDescription && <p className="mt-1 text-xs text-red-600">{lineErrors.genericDescription.message}</p>}
                    </div>
                  )}

                  <div className={`grid gap-3 ${isWeightBased ? "grid-cols-1 min-[420px]:grid-cols-3" : "grid-cols-2"}`}>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">UoM</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {isGeneric ? GENERIC_RECEIPT_UNIT : prod?.purchaseUnit || "\u2014"}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={quantityId} className="mb-1 block text-xs font-medium text-gray-600">
                        {isWeightBased ? "Peso recibido *" : "Cantidad recibida *"}
                      </label>
                      <input
                        id={quantityId}
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.receivedQuantity`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {lineErrors?.receivedQuantity && <p className="mt-1 text-xs text-red-600">{lineErrors.receivedQuantity.message}</p>}
                    </div>
                    {isWeightBased && (
                      <div>
                        <label htmlFor={`recepcion-elementos-${field.id}`} className="mb-1 block text-xs font-medium text-gray-600">
                          Bandejas / elementos *
                        </label>
                        <input
                          id={`recepcion-elementos-${field.id}`}
                          type="number"
                          min="1"
                          step="1"
                          {...register(`lines.${index}.packageCount`)}
                          className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {lineErrors?.packageCount && <p className="mt-1 text-xs text-red-600">{lineErrors.packageCount.message}</p>}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={priceId} className="mb-1 block text-xs font-medium text-gray-600">
                        Coste unitario sin IVA
                      </label>
                      <input
                        id={priceId}
                        type="number"
                        step="0.0001"
                        {...register(`lines.${index}.unitPrice`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {lineErrors?.unitPrice && <p className="mt-1 text-xs text-red-600">{lineErrors.unitPrice.message}</p>}
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">Coste unitario con IVA</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
                        {grossUnitPrice.toFixed(4)} EUR
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">PVP línea bruto</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
                        {grossLineTotal === null || grossLineTotal === undefined ? "—" : `${grossLineTotal.toFixed(2)} EUR`}
                      </div>
                    </div>
                    {isGeneric ? (
                      <div>
                        <label htmlFor={vatId} className="mb-1 block text-xs font-medium text-gray-600">
                          IVA del producto genérico (%) *
                        </label>
                        <input
                          id={vatId}
                          type="number"
                          min="0"
                          max="100"
                          step="0.0001"
                          aria-invalid={Boolean(lineErrors?.genericVatPercentage)}
                          {...register(`lines.${index}.genericVatPercentage`, {
                            setValueAs: (value) => value == null || value === "" ? null : Number(value),
                            onChange: (event) => updateGenericOcrPrice(index, event.target.value),
                          })}
                          className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {lineErrors?.genericVatPercentage && <p className="mt-1 text-xs text-red-600">{lineErrors.genericVatPercentage.message}</p>}
                      </div>
                    ) : <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">IVA aplicado</span>
                      <div className={`flex min-h-11 items-center rounded-md border px-3 py-2 text-sm font-medium ${vatPercentage === null || vatPercentage === undefined ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-900"}`}>
                        {vatPercentage === null || vatPercentage === undefined ? "Desconocido — revisar" : `${Number(vatPercentage).toFixed(2)}%`}
                      </div>
                    </div>}
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">Subtotal con IVA</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
                        {subtotal.toFixed(2)} EUR
                      </div>
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">Subtotal sin IVA</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
                        {subtotalWithoutVat.toFixed(2)} EUR
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    <div>
                      <label htmlFor={batchId} className="mb-1 block text-xs font-medium text-gray-600">
                        Lote
                      </label>
                      <input
                        id={batchId}
                        type="text"
                        {...register(`lines.${index}.batch`)}
                        placeholder="Opcional"
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={dueDateId} className="mb-1 block text-xs font-medium text-gray-600">
                        Vencimiento
                      </label>
                      <input
                        id={dueDateId}
                        type="date"
                        {...register(`lines.${index}.dueDate`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )
          })}
        </div>

        {supplierId && !productOptionsLoading && products.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Este proveedor no tiene productos del catálogo asociados. Puedes usar {GENERIC_RECEIPT_PRODUCT_LABEL}.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <button
            type="button"
            onClick={handleAddLine}
            className="min-h-11 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            + Agregar línea
          </button>
          <div className="space-y-1 text-right text-sm text-gray-900">
            <p>Productos con IVA: {productsTotal.toFixed(2)} EUR</p>
            <p>Transporte/preparación sin IVA: {transportCost.toFixed(4)} EUR</p>
            {weightedPackageCount > 0 && <p>Bandejas / elementos: {weightedPackageCount}</p>}
            {ocrPreparationGross !== null && <p className="text-xs text-gray-500">PVP preparación bruto: {ocrPreparationGross.toFixed(2)} EUR</p>}
            <p className="font-semibold">Total albarán: {totalReceipt.toFixed(2)} EUR</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Guardando..." : initialValues ? "Guardar cambios" : "Registrar recepcion"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
