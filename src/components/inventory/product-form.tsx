"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm, useWatch, type UseFormRegister } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { getProductTypeBehavior } from "@/lib/product-types"
import { calculateProductPricing } from "@/lib/product-pricing"

const productSchema = z.object({
  code: z.string().min(1, "El código es obligatorio"),
  eanBarcode: z.string().optional(),
  posDescription: z.string().min(1, "La descripción TPV es obligatoria"),
  fullDescription: z.string().min(1, "La descripción completa es obligatoria"),
  itemType: z.string().min(1, "El tipo de artículo es obligatorio"),
  family: z.string().min(1, "La familia es obligatoria"),
  subfamily: z.string().optional(),
  section: z.string().min(1, "La sección es obligatoria"),
  isPurchasable: z.boolean(),
  isPrepared: z.boolean(),
  isSellable: z.boolean(),
  hasRecipe: z.boolean(),
  baseStockUnit: z.string().min(1, "La UM base es obligatoria"),
  purchaseUnit: z.string().optional(),
  purchaseToBaseFactor: z.coerce.number().optional(),
  salesUnit: z.string().optional(),
  salesToBaseFactor: z.coerce.number().optional(),
  netWeightPerUnitGrams: z.coerce.number().optional(),
  presentationFormat: z.string().optional(),
  baseUnitCost: z.coerce.number().optional(),
  costIncludingVat: z.coerce.number().optional(),
  standardWastePercentage: z.coerce.number().optional(),
  vatCode: z.string().min(1, "El código IVA es obligatorio"),
  vatPercentage: z.coerce.number().optional(),
  purchaseVatPercentage: z.coerce.number().optional(),
  salesVatPercentage: z.coerce.number().optional(),
  pricingMethod: z.string().min(1, "El método de precio es obligatorio"),
  targetMarginPercentage: z.coerce.number().optional(),
  targetRetailPriceIncludingVat: z.coerce.number().optional(),
  fixedRetailPriceIncludingVat: z.coerce.number().optional(),
  appliedRetailPriceIncludingVat: z.coerce.number().optional(),
  appliedRetailPriceExcludingVat: z.coerce.number().optional(),
  profitPerUnit: z.coerce.number().optional(),
  actualMarginPercentage: z.coerce.number().optional(),
  percentagePointDeviation: z.coerce.number().optional(),
  unitDifference: z.coerce.number().optional(),
  pricingDiagnosis: z.string().optional(),
  stockControl: z.string().min(1, "Control de stock obligatorio"),
  valuationMethod: z.string().min(1, "Método de valoración obligatorio"),
  minimumStock: z.coerce.number().optional(),
  maximumStock: z.coerce.number().optional(),
  reorderPoint: z.coerce.number().optional(),
  location: z.string().optional(),
  abcClass: z.string().optional(),
  batchControl: z.string().min(1, "Control de lote obligatorio"),
  shelfLifeDays: z.coerce.number().int().optional(),
  storageConditions: z.string().optional(),
  allergens: z.string().optional(),
  status: z.string().min(1, "El estado es obligatorio"),
  notes: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface Product {
  id: string
  code: string
  eanBarcode: string | null
  posDescription: string
  fullDescription: string
  itemType: string
  family: string
  subfamily: string | null
  section: string
  isPurchasable: boolean
  isPrepared: boolean
  isSellable: boolean
  hasRecipe: boolean
  baseStockUnit: string
  purchaseUnit: string | null
  purchaseToBaseFactor: number | null
  salesUnit: string | null
  salesToBaseFactor: number | null
  netWeightPerUnitGrams: number | null
  presentationFormat: string | null
  baseUnitCost: number | null
  costIncludingVat: number | null
  standardWastePercentage: number | null
  vatCode: string
  vatPercentage: number | null
  purchaseVatPercentage: number | null
  salesVatPercentage: number | null
  pricingMethod: string
  targetMarginPercentage: number | null
  targetRetailPriceIncludingVat: number | null
  fixedRetailPriceIncludingVat: number | null
  appliedRetailPriceIncludingVat: number | null
  appliedRetailPriceExcludingVat: number | null
  profitPerUnit: number | null
  actualMarginPercentage: number | null
  percentagePointDeviation: number | null
  unitDifference: number | null
  pricingDiagnosis: string | null
  stockControl: string
  valuationMethod: string
  minimumStock: number | null
  maximumStock: number | null
  reorderPoint: number | null
  location: string | null
  abcClass: string | null
  batchControl: string
  shelfLifeDays: number | null
  storageConditions: string | null
  allergens: string | null
  status: string
  addedAt: string
  notes: string | null
}

interface CatalogItem {
  id: string
  type: string
  value: string
  description: string | null
  codePrefix?: string | null
}

interface PotentialDuplicate {
  id: string
  code: string
  eanBarcode: string | null
  posDescription: string
  fullDescription: string
  itemType: string
  family: string
  status: string
}

type ProductSubmitData = ProductFormValues & { confirmDuplicate: boolean }

interface ProductFormProps {
  initialValues?: Product
  onSubmit: (data: ProductSubmitData) => Promise<boolean>
  onCancel: () => void
  saving: boolean
}

function defaultValues(): ProductFormValues {
  return {
    code: "",
    eanBarcode: "",
    posDescription: "",
    fullDescription: "",
    itemType: "",
    family: "",
    subfamily: "",
    section: "",
    isPurchasable: false,
    isPrepared: false,
    isSellable: false,
    hasRecipe: false,
    baseStockUnit: "",
    purchaseUnit: "",
    purchaseToBaseFactor: undefined,
    salesUnit: "",
    salesToBaseFactor: undefined,
    netWeightPerUnitGrams: undefined,
    presentationFormat: "",
    baseUnitCost: undefined,
    costIncludingVat: undefined,
    standardWastePercentage: undefined,
    vatCode: "",
    vatPercentage: undefined,
    purchaseVatPercentage: undefined,
    salesVatPercentage: undefined,
    pricingMethod: "",
    targetMarginPercentage: undefined,
    targetRetailPriceIncludingVat: undefined,
    fixedRetailPriceIncludingVat: undefined,
    appliedRetailPriceIncludingVat: undefined,
    appliedRetailPriceExcludingVat: undefined,
    profitPerUnit: undefined,
    actualMarginPercentage: undefined,
    percentagePointDeviation: undefined,
    unitDifference: undefined,
    pricingDiagnosis: "",
    stockControl: "SI",
    valuationMethod: "",
    minimumStock: undefined,
    maximumStock: undefined,
    reorderPoint: undefined,
    location: "",
    abcClass: "",
    batchControl: "NO",
    shelfLifeDays: undefined,
    storageConditions: "",
    allergens: "",
    status: "Activo",
    notes: "",
  }
}

function toFormValues(product: Product): ProductFormValues {
  const vals = defaultValues()
  const keys = Object.keys(vals) as (keyof ProductFormValues)[]
  for (const key of keys) {
    const v = (product as unknown as Record<string, unknown>)[key]
    if (v !== null && v !== undefined) {
      ;(vals as Record<string, unknown>)[key] = v
    }
  }
  return vals
}

function CatalogSelect({
  label,
  name,
  register,
  options,
  placeholder,
  error,
  locked = false,
  lockedValue,
}: {
  label: string
  name: keyof ProductFormValues
  register: UseFormRegister<ProductFormValues>
  options: CatalogItem[]
  placeholder: string
  error?: string
  locked?: boolean
  lockedValue?: string
}) {
  const hasLockedValue = lockedValue ? options.some((option) => option.value === lockedValue) : false
  const selectId = `producto-${String(name)}`

  return (
    <div>
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">{label}</label>
      {locked && <input type="hidden" {...register(name)} value={lockedValue || ""} />}
      <select
        id={selectId}
        {...(locked ? {} : register(name))}
        value={locked ? lockedValue || "" : undefined}
        disabled={locked}
        className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${locked ? "bg-gray-100" : ""}`}
      >
        <option value="">{placeholder}</option>
        {locked && lockedValue && !hasLockedValue && <option value={lockedValue}>{lockedValue}</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.value}>
            {opt.description || opt.value}{opt.codePrefix ? ` (${opt.codePrefix})` : ""}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function TextField({
  label,
  name,
  register,
  placeholder,
  error,
  type = "text",
  readOnly = false,
}: {
  label: string
  name: keyof ProductFormValues
  register: UseFormRegister<ProductFormValues>
  placeholder: string
  error?: string
  type?: string
  readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        {...register(name)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${readOnly ? "bg-gray-100 font-mono" : ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function NumberField({
  label,
  name,
  register,
  placeholder,
  error,
  step,
}: {
  label: string
  name: keyof ProductFormValues
  register: UseFormRegister<ProductFormValues>
  placeholder: string
  error?: string
  step?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        step={step || "any"}
        {...register(name)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function CalculatedField({
  label,
  value,
  decimals = 2,
}: {
  label: string
  value: number | string | null
  decimals?: number
}) {
  const displayValue = value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))
    ? ""
    : typeof value === "number" ? value.toFixed(decimals) : value

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={displayValue}
        readOnly
        placeholder="Se calcula automáticamente"
        aria-readonly="true"
        className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-mono text-gray-900 shadow-sm"
      />
    </div>
  )
}

function CheckboxField({
  label,
  name,
  register,
  checked,
  derived = false,
}: {
  label: string
  name: keyof ProductFormValues
  register: UseFormRegister<ProductFormValues>
  checked?: boolean
  derived?: boolean
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        {...register(name)}
        checked={derived ? checked : undefined}
        readOnly={derived}
        tabIndex={derived ? -1 : undefined}
        onChange={derived ? () => undefined : undefined}
        onClick={derived ? (event) => event.preventDefault() : undefined}
        onKeyDown={derived ? (event) => event.preventDefault() : undefined}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100"
      >
        {title}
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

export default function ProductForm({
  initialValues,
  onSubmit,
  onCancel,
  saving,
}: ProductFormProps) {
  const isEditing = !!initialValues

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: initialValues ? toFormValues(initialValues) : defaultValues(),
  })

  useEffect(() => {
    reset(initialValues ? toFormValues(initialValues) : defaultValues())
  }, [initialValues, reset])

  const selectedType = useWatch({ control, name: "itemType" })
  const selectedFamily = useWatch({ control, name: "family" })
  const posDescription = useWatch({ control, name: "posDescription" })
  const fullDescription = useWatch({ control, name: "fullDescription" })
  const eanBarcode = useWatch({ control, name: "eanBarcode" })
  const isPurchasable = useWatch({ control, name: "isPurchasable" })
  const isPrepared = useWatch({ control, name: "isPrepared" })
  const isSellable = useWatch({ control, name: "isSellable" })
  const hasRecipe = useWatch({ control, name: "hasRecipe" })
  const costSinVat = useWatch({ control, name: "baseUnitCost" })
  const legacyVatPct = useWatch({ control, name: "vatPercentage" })
  const purchaseVatPercentage = useWatch({ control, name: "purchaseVatPercentage" })
  const salesVatPercentage = useWatch({ control, name: "salesVatPercentage" })
  const pricingMethod = useWatch({ control, name: "pricingMethod" })
  const targetMarginPercentage = useWatch({ control, name: "targetMarginPercentage" })
  const retailPriceIncludingVat = useWatch({ control, name: "appliedRetailPriceIncludingVat" })
  const pricing = calculateProductPricing({
    costSinVat,
    purchaseVatPercentage,
    salesVatPercentage,
    vatPercentage: legacyVatPct,
    pricingMethod,
    targetMarginPercentage,
    retailPriceIncludingVat,
  })
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError] = useState("")
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([])
  const [duplicatesLoading, setDuplicatesLoading] = useState(false)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  const [duplicateError, setDuplicateError] = useState("")

  useEffect(() => {
    if (isEditing) return
    const behavior = getProductTypeBehavior(selectedType) || {
      isPurchasable: false,
      isPrepared: false,
      isSellable: false,
      hasRecipe: false,
    }
    setValue("isPurchasable", behavior.isPurchasable)
    setValue("isPrepared", behavior.isPrepared)
    setValue("isSellable", behavior.isSellable)
    setValue("hasRecipe", behavior.hasRecipe)
  }, [isEditing, selectedType, setValue])

  useEffect(() => {
    if (isEditing || !selectedType || !selectedFamily) {
      if (!isEditing) setValue("code", "")
      return
    }

    const controller = new AbortController()
    const request = setTimeout(() => {
      setCodeLoading(true)
      setCodeError("")
      setValue("code", "")

      fetch(`/api/inventario/productos/codigo?itemType=${encodeURIComponent(selectedType)}&family=${encodeURIComponent(selectedFamily)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          const result = await res.json()
          if (!res.ok) throw new Error(result.error || "No se pudo generar el código")
          setValue("code", result.code, { shouldValidate: true })
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setCodeError(error instanceof Error ? error.message : "No se pudo generar el código")
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCodeLoading(false)
        })
    }, 0)

    return () => {
      clearTimeout(request)
      controller.abort()
    }
  }, [isEditing, selectedFamily, selectedType, setValue])

  useEffect(() => {
    if (isEditing) return

    const params = new URLSearchParams()
    if (posDescription?.trim()) params.set("posDescription", posDescription)
    if (fullDescription?.trim()) params.set("fullDescription", fullDescription)
    if (eanBarcode?.trim()) params.set("eanBarcode", eanBarcode)

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      setDuplicates([])
      setDuplicateConfirmed(false)
      setDuplicateError("")
      if (!params.toString()) {
        setDuplicatesLoading(false)
        return
      }
      setDuplicatesLoading(true)
      fetch(`/api/inventario/productos/duplicados?${params}`, { signal: controller.signal })
        .then(async (res) => {
          const result = await res.json()
          if (!res.ok) throw new Error(result.error || "No se pudieron buscar duplicados")
          setDuplicates(result.products || [])
        })
        .catch(() => {
          if (!controller.signal.aborted) setDuplicates([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setDuplicatesLoading(false)
        })
    }, params.toString() ? 350 : 0)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [eanBarcode, fullDescription, posDescription, isEditing])

  const [catalogs, setCatalogs] = useState<Record<string, CatalogItem[]>>({})

  const loadCatalog = useCallback(async (type: string) => {
    if (catalogs[type]) return
    try {
      const res = await fetch(`/api/inventario/catalogos?type=${encodeURIComponent(type)}`)
      if (res.ok) {
        const data = await res.json()
        setCatalogs((prev) => ({ ...prev, [type]: data }))
      }
    } catch { /* empty */ }
  }, [catalogs])

  useEffect(() => {
    const types = [
      "TIPO_ARTICULO", "FAMILIA", "SUBFAMILIA", "SECCION", "UNIDAD_MEDIDA",
      "SI_NO", "VALORACION", "METODO_PRECIO", "CLASE_ABC", "UBICACION",
      "CONSERVACION", "ESTADO", "CODIGO_IVA", "PROVEEDOR",
    ]
    types.forEach(loadCatalog)
  }, [loadCatalog])

  async function handleFormSubmit(data: ProductFormValues) {
    if (!isEditing && duplicates.length > 0 && !duplicateConfirmed) {
      setDuplicateError("Revisa los productos encontrados y confirma para continuar")
      return
    }

    setDuplicateError("")
    const ok = await onSubmit({
      ...data,
      purchaseVatPercentage: pricing.purchaseVatPercentage ?? undefined,
      salesVatPercentage: pricing.salesVatPercentage ?? undefined,
      vatPercentage: pricing.vatPercentage ?? undefined,
      costIncludingVat: pricing.costIncludingVat ?? undefined,
      appliedRetailPriceExcludingVat: pricing.retailPriceExcludingVat ?? undefined,
      profitPerUnit: pricing.profitPerUnit ?? undefined,
      actualMarginPercentage: pricing.actualMarginPercentage ?? undefined,
      confirmDuplicate: duplicateConfirmed,
    })
    if (ok && !isEditing) reset(defaultValues())
  }

  const catalogOptions = (type: string) => catalogs[type] || []

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Section title="Identificación" defaultOpen>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Código generado *"
            name="code"
            register={register}
            placeholder={codeLoading && selectedType && selectedFamily ? "Generando..." : "Selecciona tipo y familia"}
            error={errors.code?.message || codeError}
            readOnly
          />
          <TextField label="Código de barras EAN" name="eanBarcode" register={register} placeholder="8412345678901" error={errors.eanBarcode?.message} />
          <TextField label="Descripción TPV *" name="posDescription" register={register} placeholder="Harina trigo W180" error={errors.posDescription?.message} />
          <div className="sm:col-span-2">
            <TextField label="Descripción completa *" name="fullDescription" register={register} placeholder="Harina trigo W180 saco 25 kg" error={errors.fullDescription?.message} />
          </div>
        </div>
        {!isEditing && duplicatesLoading && <p className="mt-3 text-xs text-gray-500">Buscando productos parecidos...</p>}
        {!isEditing && duplicates.length > 0 && (
          <div role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Posibles productos duplicados:</p>
            <ul className="mt-1 list-disc pl-5">
              {duplicates.map((product) => (
                <li key={product.id}>
                  <span className="font-mono">{product.code}</span> - {product.fullDescription} ({product.status})
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-start gap-2">
              <input
                type="checkbox"
                checked={duplicateConfirmed}
                onChange={(event) => {
                  setDuplicateConfirmed(event.target.checked)
                  setDuplicateError("")
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>He revisado los productos y confirmo que este artículo es distinto.</span>
            </label>
            {duplicateError && <p className="mt-2 text-xs text-red-700">{duplicateError}</p>}
          </div>
        )}
      </Section>

      <Section title="Clasificación">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect
            label="Tipo de artículo *"
            name="itemType"
            register={register}
            options={catalogOptions("TIPO_ARTICULO")}
            placeholder="Seleccionar tipo..."
            error={errors.itemType?.message}
            locked={isEditing}
            lockedValue={initialValues?.itemType}
          />
          <CatalogSelect
            label="Familia *"
            name="family"
            register={register}
            options={catalogOptions("FAMILIA")}
            placeholder="Seleccionar familia..."
            error={errors.family?.message}
            locked={isEditing}
            lockedValue={initialValues?.family}
          />
          <CatalogSelect label="Subfamilia" name="subfamily" register={register} options={catalogOptions("SUBFAMILIA")} placeholder="Seleccionar subfamilia..." error={errors.subfamily?.message} />
          <CatalogSelect label="Sección *" name="section" register={register} options={catalogOptions("SECCION")} placeholder="Seleccionar sección..." error={errors.section?.message} />
          <div className="flex flex-wrap gap-6 pt-2">
            <CheckboxField label="Es comprable" name="isPurchasable" register={register} checked={isPurchasable} derived />
            <CheckboxField label="Es elaborado" name="isPrepared" register={register} checked={isPrepared} derived />
            <CheckboxField label="Es vendible" name="isSellable" register={register} checked={isSellable} derived />
            <CheckboxField label="Lleva receta" name="hasRecipe" register={register} checked={hasRecipe} derived />
          </div>
        </div>
      </Section>

      <Section title="Unidades de medida">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="UM base stock *" name="baseStockUnit" register={register} options={catalogOptions("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.baseStockUnit?.message} />
          <CatalogSelect label="UM compra" name="purchaseUnit" register={register} options={catalogOptions("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.purchaseUnit?.message} />
          <NumberField label="Factor compra a base" name="purchaseToBaseFactor" register={register} placeholder="25" error={errors.purchaseToBaseFactor?.message} />
          <CatalogSelect label="UM venta" name="salesUnit" register={register} options={catalogOptions("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.salesUnit?.message} />
          <NumberField label="Factor venta a base" name="salesToBaseFactor" register={register} placeholder="1" error={errors.salesToBaseFactor?.message} />
          <NumberField label="Peso neto ud (g)" name="netWeightPerUnitGrams" register={register} placeholder="250" error={errors.netWeightPerUnitGrams?.message} />
          <div className="sm:col-span-2">
            <TextField label="Formato presentación" name="presentationFormat" register={register} placeholder="Saco 25 kg" error={errors.presentationFormat?.message} />
          </div>
        </div>
      </Section>

      <Section title="Costes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="Coste Sin IVA (€)" name="baseUnitCost" register={register} placeholder="0.74" error={errors.baseUnitCost?.message} />
          <CalculatedField label="Coste Con IVA (€)" value={pricing.costIncludingVat} />
          <NumberField label="Merma estándar (%)" name="standardWastePercentage" register={register} placeholder="1.0" error={errors.standardWastePercentage?.message} />
        </div>
      </Section>

      <Section title="Fiscal y precios">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Código IVA *" name="vatCode" register={register} options={catalogOptions("CODIGO_IVA")} placeholder="Seleccionar código..." error={errors.vatCode?.message} />
          <NumberField label="IVA Compra (%)" name="purchaseVatPercentage" register={register} placeholder="4" error={errors.purchaseVatPercentage?.message} />
          <NumberField label="IVA Venta (%)" name="salesVatPercentage" register={register} placeholder="10" error={errors.salesVatPercentage?.message} />
          <CatalogSelect label="Método precio *" name="pricingMethod" register={register} options={catalogOptions("METODO_PRECIO")} placeholder="Seleccionar método..." error={errors.pricingMethod?.message} />
          <NumberField label="Margen objetivo %" name="targetMarginPercentage" register={register} placeholder="70" error={errors.targetMarginPercentage?.message} />
           <CalculatedField label="PVP objetivo con IVA (€)" value={pricing.targetRetailPriceIncludingVat} />
           {pricingMethod === "FIJO" ? (
             <NumberField label="PVP de venta con IVA (€)" name="appliedRetailPriceIncludingVat" register={register} placeholder="1.20" error={errors.appliedRetailPriceIncludingVat?.message} />
           ) : (
             <CalculatedField label="PVP de venta con IVA (€)" value={pricing.appliedRetailPriceIncludingVat} />
           )}
           <CalculatedField label="PVP de venta sin IVA (€)" value={pricing.retailPriceExcludingVat} />
           <CalculatedField label="Ganancia (€/ud)" value={pricing.profitPerUnit} />
           <CalculatedField label="Margen Real (%)" value={pricing.actualMarginPercentage} />
           <CalculatedField label="Desviación (pp)" value={pricing.percentagePointDeviation} />
           <CalculatedField label="Diferencia EUR/ud" value={pricing.unitDifference} decimals={4} />
           <CalculatedField label="Diagnóstico precio" value={pricing.pricingDiagnosis} />
        </div>
      </Section>

      <Section title="Control de inventario">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Controla stock *" name="stockControl" register={register} options={catalogOptions("SI_NO")} placeholder="Seleccionar..." error={errors.stockControl?.message} />
          <CatalogSelect label="Método valoración *" name="valuationMethod" register={register} options={catalogOptions("VALORACION")} placeholder="Seleccionar método..." error={errors.valuationMethod?.message} />
          <NumberField label="Stock mínimo" name="minimumStock" register={register} placeholder="50" error={errors.minimumStock?.message} />
          <NumberField label="Stock máximo" name="maximumStock" register={register} placeholder="300" error={errors.maximumStock?.message} />
          <NumberField label="Punto de pedido" name="reorderPoint" register={register} placeholder="100" error={errors.reorderPoint?.message} />
          <CatalogSelect label="Ubicación" name="location" register={register} options={catalogOptions("UBICACION")} placeholder="Seleccionar ubicación..." error={errors.location?.message} />
          <CatalogSelect label="Clase ABC" name="abcClass" register={register} options={catalogOptions("CLASE_ABC")} placeholder="Seleccionar clase..." error={errors.abcClass?.message} />
        </div>
      </Section>

      <Section title="Trazabilidad y estado">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Control de lote *" name="batchControl" register={register} options={catalogOptions("SI_NO")} placeholder="Seleccionar..." error={errors.batchControl?.message} />
          <NumberField label="Vida útil (días)" name="shelfLifeDays" register={register} placeholder="180" error={errors.shelfLifeDays?.message} />
          <CatalogSelect label="Conservación" name="storageConditions" register={register} options={catalogOptions("CONSERVACION")} placeholder="Seleccionar conservación..." error={errors.storageConditions?.message} />
          <div className="sm:col-span-2">
            <TextField label="Alérgenos (separados por punto y coma)" name="allergens" register={register} placeholder="Gluten; Leche; Huevos" error={errors.allergens?.message} />
          </div>
          <CatalogSelect label="Estado *" name="status" register={register} options={catalogOptions("ESTADO")} placeholder="Seleccionar estado..." error={errors.status?.message} />
          <div className="sm:col-span-2">
            <TextField label="Observaciones" name="notes" register={register} placeholder="Notas internas, condiciones del proveedor, estacionalidad..." error={errors.notes?.message} />
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear producto"}
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
