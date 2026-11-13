"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { calculateVatInclusiveAmount } from "@/lib/product-pricing"
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
  baseUnitCost: number | string | null
  purchaseVatPercentage: number | string | null
  vatPercentage: number | string | null
}

const lineSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  receivedQuantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unitPrice: z.coerce.number().min(0, "El precio no puede ser negativo"),
  batch: z.string().optional(),
  dueDate: z.string().optional(),
})

const receiptSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor"),
  deliveryNoteCode: z.string().min(1, "El código de albarán es obligatorio"),
  receivedAt: z.string().min(1, "La fecha es obligatoria"),
  notes: z.string().optional(),
  transportCost: z.coerce.number().finite().nonnegative("El transporte no puede ser negativo"),
  lines: z
    .array(lineSchema)
    .min(1, "Agrega al menos una línea de producto"),
})

export type ReceiptFormValues = z.infer<typeof receiptSchema>

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
    lines: [{ productId: "", receivedQuantity: 1, unitPrice: 0, batch: "", dueDate: "" }],
  }
}

function ProductCombobox({
  products,
  value,
  onSelect,
  id,
  disabled = false,
  placeholder = "Buscar producto...",
}: {
  products: Product[]
  value: string
  onSelect: (productId: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = products.find((p) => p.id === value)

  const filtered = products.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.code.toLowerCase().includes(q) ||
      p.posDescription.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setSearch("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
      setSearch("")
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        type="text"
        readOnly
        value={selected ? `${selected.code} - ${selected.posDescription}` : ""}
        placeholder={placeholder}
        onFocus={() => { if (!disabled) setOpen(true) }}
        onClick={() => { if (!disabled) setOpen(true) }}
        disabled={disabled}
        className={`w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-gray-300 px-2 py-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${disabled ? "cursor-not-allowed bg-gray-100" : "cursor-pointer"}`}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 bg-white p-1">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribir para filtrar..."
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-2 py-1 text-xs text-gray-500">Sin resultados</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p.id)}
                className={`block w-full px-2 py-1 text-left text-xs hover:bg-blue-50 ${
                  p.id === value ? "bg-blue-100 font-medium" : ""
                }`}
              >
                <span className="font-mono">{p.code}</span>{" "}
                <span className="text-gray-600">{p.posDescription}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
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
  const [products, setProducts] = useState<Product[]>([])
  const [productsSupplierId, setProductsSupplierId] = useState("")
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrError, setOcrError] = useState("")
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([])
  const [ocrUnmatched, setOcrUnmatched] = useState<number | null>(null)
  const [documentRead, setDocumentRead] = useState(false)
  const [ocrReviewed, setOcrReviewed] = useState(false)
  const [pendingOcrLines, setPendingOcrLines] = useState<DeliveryNoteLineDraft[] | null>(null)
  const pendingOcrLinesRef = useRef<DeliveryNoteLineDraft[] | null>(null)
  const [ocrGrossTotals, setOcrGrossTotals] = useState<Array<number | null>>([])
  const [ocrTaxes, setOcrTaxes] = useState<DeliveryNoteTaxDraft[]>([])
  const [ocrPreparationGross, setOcrPreparationGross] = useState<number | null>(null)
  const [ocrTotalGross, setOcrTotalGross] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    getValues,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema) as Resolver<ReceiptFormValues>,
    defaultValues: initialValues || defaultReceiptValues(),
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "lines",
  })

  const supplierId = watch("supplierId")
  const lines = watch("lines")
  const [productsLoading, setProductsLoading] = useState(false)
  const previousSupplierId = useRef("")

  useEffect(() => {
    if (initialValues) reset(initialValues)
    pendingOcrLinesRef.current = null
    setPendingOcrLines(null)
    setOcrWarnings([])
    setOcrUnmatched(null)
    setOcrGrossTotals([])
    setOcrTaxes([])
    setOcrPreparationGross(null)
    setOcrTotalGross(null)
    setOcrReviewed(false)
    setOcrStatus("")
    setOcrError("")
    setDocumentRead(false)
  }, [initialValues, reset])

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const previousId = previousSupplierId.current
    previousSupplierId.current = supplierId

    if (previousId && previousId !== supplierId && !pendingOcrLinesRef.current) {
      getValues("lines").forEach((_, index) => {
        setValue(`lines.${index}.productId`, "")
        setValue(`lines.${index}.unitPrice`, 0)
        setValue(`lines.${index}.batch`, "")
        setValue(`lines.${index}.dueDate`, "")
      })
    }

    if (!supplierId) {
      setProducts([])
      setProductsSupplierId("")
      setProductsLoading(false)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ supplierId })
    setProducts([])
    setProductsSupplierId("")
    setProductsLoading(true)

    fetch(`/api/inventario/recepciones/productos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Error al cargar productos")
        return response.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setProducts(data.products || [])
          setProductsSupplierId(supplierId)
        }
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return
        if (!controller.signal.aborted) setProducts([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductsLoading(false)
      })

    return () => controller.abort()
  }, [getValues, supplierId, setValue])

  useEffect(() => {
    if (!pendingOcrLines || !products.length || productsSupplierId !== supplierId) return
    const mappedLines = pendingOcrLines.map((line) => {
      const product = matchDeliveryProduct(line.description, products)
      const quantity = Number(line.quantity)
      const grossTotal = Number(line.lineTotal)
      return {
        productId: product?.id || "",
        receivedQuantity: quantity > 0 ? quantity : 1,
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
    if (unmatched > 0) setOcrWarnings((current) => current.some((warning) => warning.startsWith("Hay líneas sin asociar")) ? current : [...current, `Hay líneas sin asociar a productos del catálogo: ${unmatched}`])
    pendingOcrLinesRef.current = null
    setPendingOcrLines(null)
  }, [pendingOcrLines, products, productsSupplierId, replace, supplierId])

  const handleAddLine = () => {
    append({ productId: "", receivedQuantity: 1, unitPrice: 0, batch: "", dueDate: "" })
    setOcrGrossTotals((current) => [...current, null])
  }

  const handleProductChange = (index: number, productId: string) => {
    setValue(`lines.${index}.productId`, productId)
    const prod = products.find((p) => p.id === productId)
    const extractedTotal = ocrGrossTotals[index]
    const quantity = Number(getValues(`lines.${index}.receivedQuantity`))
    if (extractedTotal != null && prod) {
      setValue(`lines.${index}.unitPrice`, grossLineTotalToNetUnitPrice(extractedTotal, quantity, prod.purchaseVatPercentage ?? prod.vatPercentage))
    } else if (prod?.baseUnitCost != null) {
      setValue(`lines.${index}.unitPrice`, Number(prod.baseUnitCost))
    }
  }

  async function handleFile(file: File) {
    setOcrError("")
    setOcrWarnings([])
    setOcrUnmatched(null)
    setOcrReviewed(false)
    setDocumentRead(false)
    pendingOcrLinesRef.current = null
    setPendingOcrLines(null)
    setOcrGrossTotals([])
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

      setValue("supplierId", supplier?.id || "")
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
        replace(draft.lines.map((line) => ({
          productId: "",
          receivedQuantity: Number(line.quantity) || 1,
          unitPrice: Number(line.lineTotal) / (Number(line.quantity) || 1),
          batch: "",
          dueDate: "",
        })))
        setOcrGrossTotals(draft.lines.map((line) => Number(line.lineTotal)))
        pendingOcrLinesRef.current = draft.lines
        setPendingOcrLines(draft.lines)
      } else {
        pendingOcrLinesRef.current = null
        setPendingOcrLines(null)
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

  const getProductInfo = (productId: string) => {
    return products.find((p) => p.id === productId)
  }

  const getUnitPriceIncludingVat = (unitPrice: unknown, product?: Product) => {
    return calculateVatInclusiveAmount({
      amount: unitPrice,
      vatPercentage: product?.purchaseVatPercentage ?? product?.vatPercentage,
    }) ?? 0
  }

  const productsTotal = (lines || []).reduce((sum, l) => {
    const product = getProductInfo(l.productId || "")
    return sum + Number(l.receivedQuantity || 0) * getUnitPriceIncludingVat(l.unitPrice, product)
  }, 0)
  const transportCost = Number(watch("transportCost") || 0)
  const ocrFiscalValidation = useMemo(() => {
    if (!documentRead) return null
    return validateDeliveryNoteFiscalBreakdown({
      lines: (lines || []).map((line, index) => {
        const product = products.find((candidate) => candidate.id === line.productId)
        return {
          quantity: line.receivedQuantity,
          netUnitPrice: line.unitPrice,
          vatPercentage: product?.purchaseVatPercentage ?? product?.vatPercentage,
          grossLineTotal: ocrGrossTotals[index],
        }
      }),
      taxes: ocrTaxes,
      preparationGross: ocrPreparationGross,
      preparationNet: transportCost,
      totalGross: ocrTotalGross,
    })
  }, [documentRead, lines, ocrGrossTotals, ocrPreparationGross, ocrTaxes, ocrTotalGross, products, transportCost])
  const transportGross = ocrPreparationGross ?? transportCost
  const totalReceipt = productsTotal + transportGross
  const productPlaceholder = !supplierId
    ? "Selecciona primero un proveedor..."
    : productsLoading
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
            {...register("supplierId")}
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
        <p className="mb-3 text-xs text-gray-500">Añade una tarjeta por cada producto que figure en el albarán.</p>

        {errors.lines && (
          <p className="mb-2 text-xs text-red-600">{errors.lines.message || errors.lines.root?.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const prod = getProductInfo(lines?.[index]?.productId || "")
            const line = lines?.[index]
            const unitPriceWithoutVat = Number(line?.unitPrice || 0)
            const unitPriceIncludingVat = getUnitPriceIncludingVat(line?.unitPrice, prod)
            const quantity = Number(line?.receivedQuantity || 0)
            const subtotalWithoutVat = quantity * unitPriceWithoutVat
            const subtotal = quantity * unitPriceIncludingVat
            const vatPercentage = prod?.purchaseVatPercentage ?? prod?.vatPercentage
            const grossLineTotal = ocrGrossTotals[index]
            const grossUnitPrice = grossLineTotal !== null && grossLineTotal !== undefined && quantity > 0
              ? grossLineTotal / quantity
              : unitPriceIncludingVat
            const productId = `recepcion-producto-${field.id}`
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
                      onClick={() => { remove(index); setOcrGrossTotals((current) => current.filter((_, lineIndex) => lineIndex !== index)) }}
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
                      products={products}
                      value={lines?.[index]?.productId || ""}
                      onSelect={(id) => handleProductChange(index, id)}
                      disabled={!supplierId || productsLoading}
                      placeholder={productPlaceholder}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">UoM</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {prod?.purchaseUnit || "\u2014"}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={quantityId} className="mb-1 block text-xs font-medium text-gray-600">
                        Cantidad recibida *
                      </label>
                      <input
                        id={quantityId}
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.receivedQuantity`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
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
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">IVA aplicado</span>
                      <div className={`flex min-h-11 items-center rounded-md border px-3 py-2 text-sm font-medium ${vatPercentage === null || vatPercentage === undefined ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-900"}`}>
                        {vatPercentage === null || vatPercentage === undefined ? "Desconocido — revisar" : `${Number(vatPercentage).toFixed(2)}%`}
                      </div>
                    </div>
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

        {supplierId && !productsLoading && products.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Este proveedor no tiene productos comprables activos asociados.
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
