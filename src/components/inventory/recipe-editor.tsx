"use client"

import { useState } from "react"
import { calculateProductPricing } from "@/lib/product-pricing"
import { calculateRecipeUnitCost } from "@/lib/recipe-costing"

export type RecipeEditorProduct = {
  id: string
  code: string
  posDescription: string
  fullDescription?: string | null
  isSellable?: boolean
  salesVatPercentage?: number | string | null
  fixedRetailPriceIncludingVat?: number | string | null
  appliedRetailPriceIncludingVat?: number | string | null
  baseStockUnit: string
  isPrepared?: boolean
  purchaseToBaseFactor?: number | string | null
  baseUnitCost?: number | string | null
  status: string
  stockControl: string
}

export type RecipeEditorCatalog = {
  id: string
  type: string
  value: string
  codePrefix?: string | null
}

export type RecipeVersionSource = {
  id: string
  product: RecipeEditorProduct & { fullDescription?: string | null; salesVatPercentage?: number | string | null; fixedRetailPriceIncludingVat?: number | string | null; appliedRetailPriceIncludingVat?: number | string | null }
  versions: Array<{
    status: string
    tolerancePercentage: number | string
    components: Array<{ componentProduct: { id: string }; quantityPerUnit: number | string }>
  }>
}

const EMPTY_PRODUCT = {
  posDescription: "",
  fullDescription: "",
  eanBarcode: "",
  itemType: "PT",
  family: "",
  subfamily: "",
  section: "",
  baseStockUnit: "ud",
  salesUnit: "ud",
  salesToBaseFactor: "1",
  presentationFormat: "",
  standardWastePercentage: "",
  vatCode: "",
  salesVatPercentage: "",
  salePriceIncludingVat: "",
  valuationMethod: "PMP",
  minimumStock: "",
  maximumStock: "",
  reorderPoint: "",
  location: "",
  abcClass: "",
  batchControl: "NO",
  shelfLifeDays: "",
  storageConditions: "",
  allergens: "",
  notes: "",
  confirmDuplicate: false,
}

function optionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".")
  if (normalized === "") return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function RecipeEditor({
  products,
  catalogs,
  source,
  onCancel,
  onSaved,
}: {
  products: RecipeEditorProduct[]
  catalogs: Record<string, RecipeEditorCatalog[]>
  source?: RecipeVersionSource
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const sourceVersion = source?.versions.find((version) => version.status === "ACTIVE") || source?.versions[0]
  const [output, setOutput] = useState(() => source ? {
    ...EMPTY_PRODUCT,
    posDescription: source.product.posDescription,
    fullDescription: source.product.fullDescription || source.product.posDescription,
    itemType: source.product.isSellable ? "PT" : "SE",
    baseStockUnit: source.product.baseStockUnit,
    salesUnit: source.product.baseStockUnit,
    salesVatPercentage: source.product.salesVatPercentage == null ? "" : String(source.product.salesVatPercentage),
    salePriceIncludingVat: source.product.fixedRetailPriceIncludingVat == null
      ? source.product.appliedRetailPriceIncludingVat == null ? "" : String(source.product.appliedRetailPriceIncludingVat)
      : String(source.product.fixedRetailPriceIncludingVat),
  } : EMPTY_PRODUCT)
  const [tolerance, setTolerance] = useState(String(sourceVersion?.tolerancePercentage ?? 5))
  const [components, setComponents] = useState(
    sourceVersion?.components.map((component) => ({
      componentProductId: component.componentProduct.id,
      quantityPerUnit: String(component.quantityPerUnit),
    })) || [{ componentProductId: "", quantityPerUnit: "" }],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const isNewRecipe = !source
  const isFinishedProduct = output.itemType === "PT"
  const salesVatPercentage = optionalNumber(output.salesVatPercentage)
  const salePriceIncludingVat = optionalNumber(output.salePriceIncludingVat)
  const familyOptions = (catalogs.FAMILIA || []).filter((item) => output.itemType !== "SE" || item.codePrefix === "SEM")
  const estimatedCostResult = (() => {
    try {
      const costComponents = components.filter((component) => component.componentProductId).map((component) => {
        const product = products.find((item) => item.id === component.componentProductId)
        if (!product) throw new Error("missing")
        const quantityPerUnit = optionalNumber(component.quantityPerUnit)
        if (quantityPerUnit == null || quantityPerUnit <= 0) throw new Error("invalid quantity")
        return {
          componentProductId: product.id,
          quantityPerUnit,
          componentProduct: {
            code: product.code,
            isPrepared: product.isPrepared,
            baseUnitCost: product.baseUnitCost == null ? null : Number(product.baseUnitCost),
            purchaseToBaseFactor: product.purchaseToBaseFactor == null ? null : Number(product.purchaseToBaseFactor),
          },
        }
      })
      return costComponents.length === 0 ? null : calculateRecipeUnitCost(costComponents)
    } catch {
      return null
    }
  })()
  const estimatedCost = estimatedCostResult?.calculatedUnitCost ?? null
  const estimatedPricing = estimatedCost != null && isFinishedProduct && salesVatPercentage != null && salePriceIncludingVat != null && salePriceIncludingVat > 0
    ? calculateProductPricing({
        costSinVat: estimatedCost,
        purchaseCostSinVat: estimatedCost,
        salesVatPercentage,
        pricingMethod: "FIJO",
        retailPriceIncludingVat: salePriceIncludingVat,
      })
    : null

  function setProductField<K extends keyof typeof EMPTY_PRODUCT>(field: K, value: (typeof EMPTY_PRODUCT)[K]) {
    setOutput((current) => ({ ...current, [field]: value }))
  }

  async function submit(activate = false) {
    setSaving(true)
    setError("")
    try {
      const componentPayload = components.map((component) => ({
        componentProductId: component.componentProductId,
        quantityPerUnit: optionalNumber(component.quantityPerUnit) ?? 0,
      }))
      const body = source ? {
        product: {
          posDescription: output.posDescription,
          fullDescription: output.fullDescription,
          salesVatPercentage: optionalNumber(output.salesVatPercentage),
          salePriceIncludingVat: optionalNumber(output.salePriceIncludingVat),
        },
        tolerancePercentage: Number(tolerance),
        components: componentPayload,
      } : {
        mode: "NEW_RECIPE",
        activate,
        tolerancePercentage: Number(tolerance),
        components: componentPayload,
        product: {
          ...output,
          salesToBaseFactor: optionalNumber(output.salesToBaseFactor),
          standardWastePercentage: optionalNumber(output.standardWastePercentage),
          salesVatPercentage: optionalNumber(output.salesVatPercentage),
          salePriceIncludingVat: optionalNumber(output.salePriceIncludingVat),
          minimumStock: optionalNumber(output.minimumStock),
          maximumStock: optionalNumber(output.maximumStock),
          reorderPoint: optionalNumber(output.reorderPoint),
          shelfLifeDays: optionalNumber(output.shelfLifeDays),
        },
      }
      const response = await fetch(source ? `/api/inventario/recetas/${source.id}` : "/api/inventario/recetas", {
        method: source ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la receta")
      await onSaved(isNewRecipe
        ? activate
          ? `Receta y producto ${result.recipe?.product?.code || ""} creados y activados`
          : `Receta y producto ${result.recipe?.product?.code || ""} creados en borrador`
        : "Receta actualizada")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la receta")
    } finally {
      setSaving(false)
    }
  }

  const requiredOutputMissing = isNewRecipe && (
    !output.posDescription.trim() ||
    !output.fullDescription.trim() ||
    !output.family ||
    !output.section ||
    !output.baseStockUnit ||
    !output.vatCode ||
    !output.valuationMethod ||
    !output.batchControl ||
    (isFinishedProduct && (salesVatPercentage == null || salePriceIncludingVat == null || salePriceIncludingVat <= 0))
  )
  const invalidComponents = components.some((component) => !component.componentProductId || !((optionalNumber(component.quantityPerUnit) ?? 0) > 0))

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{isNewRecipe ? "Nueva receta" : `Editar receta · ${source.product.code}`}</h3>
          <p className="text-xs text-gray-600">{isNewRecipe ? "Producto resultado y receta se crearán juntos." : source.product.posDescription}</p>
        </div>
        <button type="button" onClick={onCancel} className="self-start rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700">Cancelar</button>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isNewRecipe && (
        <>
          <section className="mt-4">
            <h4 className="text-sm font-semibold text-gray-900">Producto resultado</h4>
            <p className="mt-1 text-xs text-gray-500">Código automático. Estado Activo. Coste sale de componentes. Margen sale de PVP y coste.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-gray-700">Nombre TPV *<input value={output.posDescription} onChange={(event) => setProductField("posDescription", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Descripción completa *<input value={output.fullDescription} onChange={(event) => setProductField("fullDescription", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Tipo *<select value={output.itemType} onChange={(event) => setOutput((current) => ({ ...current, itemType: event.target.value, family: "" }))} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="PT">PT · Producto terminado</option><option value="SE">SE · Semielaborado</option></select></label>
              <label className="text-xs text-gray-700">Familia *<select value={output.family} onChange={(event) => setProductField("family", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar...</option>{familyOptions.map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Subfamilia<select value={output.subfamily} onChange={(event) => setProductField("subfamily", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Sin subfamilia</option>{(catalogs.SUBFAMILIA || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Sección *<select value={output.section} onChange={(event) => setProductField("section", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar...</option>{(catalogs.SECCION || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Código EAN<input value={output.eanBarcode} onChange={(event) => setProductField("eanBarcode", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Presentación<input value={output.presentationFormat} onChange={(event) => setProductField("presentationFormat", event.target.value)} placeholder="Ej: unidad en vitrina" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
            </div>
          </section>

          <section className="mt-5 border-t border-indigo-100 pt-4">
            <h4 className="text-sm font-semibold text-gray-900">Unidades, precio e inventario</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-700">Unidad base *<select value={output.baseStockUnit} onChange={(event) => setProductField("baseStockUnit", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">{(catalogs.UNIDAD_MEDIDA || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Unidad venta<select value={output.salesUnit} onChange={(event) => setProductField("salesUnit", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">{(catalogs.UNIDAD_MEDIDA || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Factor venta a base<input type="number" min="0.000001" step="0.000001" value={output.salesToBaseFactor} onChange={(event) => setProductField("salesToBaseFactor", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Código IVA *<select value={output.vatCode} onChange={(event) => setProductField("vatCode", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar...</option>{(catalogs.CODIGO_IVA || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">IVA venta {isFinishedProduct ? "*" : ""}<input type="text" inputMode="decimal" value={output.salesVatPercentage} onChange={(event) => setProductField("salesVatPercentage", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
              <label className="text-xs text-gray-700">Precio venta con IVA {isFinishedProduct ? "*" : ""}<input type="text" inputMode="decimal" placeholder="0,00" value={output.salePriceIncludingVat} onChange={(event) => setProductField("salePriceIncludingVat", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
               <div className="rounded-md bg-white p-2 text-xs text-gray-700"><span className="font-medium">Coste de receta por unidad producida</span><br />{estimatedCost == null ? "Pendiente de componentes" : `${estimatedCost.toFixed(4)} €`}</div>
              <div className="rounded-md bg-white p-2 text-xs text-gray-700"><span className="font-medium">Margen calculado</span><br />{estimatedPricing?.actualMarginPercentage == null ? "Pendiente de precio/coste" : `${estimatedPricing.actualMarginPercentage.toFixed(2)} %`}</div>
              <label className="text-xs text-gray-700">Valoración *<select value={output.valuationMethod} onChange={(event) => setProductField("valuationMethod", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">{(catalogs.VALORACION || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Merma estándar %<input type="number" min="0" max="100" step="0.01" value={output.standardWastePercentage} onChange={(event) => setProductField("standardWastePercentage", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Ubicación<select value={output.location} onChange={(event) => setProductField("location", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Sin ubicación</option>{(catalogs.UBICACION || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Clase ABC<select value={output.abcClass} onChange={(event) => setProductField("abcClass", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Sin clase</option>{(catalogs.CLASE_ABC || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Stock mínimo<input type="number" min="0" step="0.001" value={output.minimumStock} onChange={(event) => setProductField("minimumStock", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Stock máximo<input type="number" min="0" step="0.001" value={output.maximumStock} onChange={(event) => setProductField("maximumStock", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Punto pedido<input type="number" min="0" step="0.001" value={output.reorderPoint} onChange={(event) => setProductField("reorderPoint", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
            </div>
          </section>

          <section className="mt-5 border-t border-indigo-100 pt-4">
            <h4 className="text-sm font-semibold text-gray-900">Trazabilidad</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-700">Control lote *<select value={output.batchControl} onChange={(event) => setProductField("batchControl", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">{(catalogs.SI_NO || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700">Vida útil días<input type="number" min="0" step="1" value={output.shelfLifeDays} onChange={(event) => setProductField("shelfLifeDays", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700">Conservación<select value={output.storageConditions} onChange={(event) => setProductField("storageConditions", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Sin especificar</option>{(catalogs.CONSERVACION || []).map((item) => <option key={item.id} value={item.value}>{item.value}</option>)}</select></label>
              <label className="text-xs text-gray-700 sm:col-span-3">Alérgenos<input value={output.allergens} onChange={(event) => setProductField("allergens", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs text-gray-700 sm:col-span-3">Notas<textarea value={output.notes} onChange={(event) => setProductField("notes", event.target.value)} className="mt-1 min-h-16 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-2 text-xs text-amber-800 sm:col-span-3"><input type="checkbox" checked={output.confirmDuplicate} onChange={(event) => setProductField("confirmDuplicate", event.target.checked)} />Confirmo que producto resultado no duplica otro producto existente.</label>
            </div>
          </section>
        </>
      )}

      {!isNewRecipe && (
        <section className="mt-4 border-t border-indigo-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-900">Producto y precio</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-700">Nombre TPV *<input value={output.posDescription} onChange={(event) => setProductField("posDescription", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
            <label className="text-xs text-gray-700">Descripción completa *<input value={output.fullDescription} onChange={(event) => setProductField("fullDescription", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
            <label className="text-xs text-gray-700">IVA venta *<input type="text" inputMode="decimal" value={output.salesVatPercentage} onChange={(event) => setProductField("salesVatPercentage", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
            <label className="text-xs text-gray-700">Precio venta con IVA *<input type="text" inputMode="decimal" placeholder="0,00" value={output.salePriceIncludingVat} onChange={(event) => setProductField("salePriceIncludingVat", event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
          </div>
          <p className="mt-2 text-xs text-gray-600">Coste estimado: {estimatedCost == null ? "pendiente" : `${estimatedCost.toFixed(4)} €`} · Margen calculado: {estimatedPricing?.actualMarginPercentage == null ? "pendiente" : `${estimatedPricing.actualMarginPercentage.toFixed(2)} %`}</p>
        </section>
      )}

      <section className="mt-5 border-t border-indigo-100 pt-4 text-gray-900">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <h4 className="text-sm font-semibold text-gray-900">Componentes por una unidad producida</h4>
          <label className="text-xs text-gray-700">Tolerancia %<input type="number" min="0" max="100" step="0.01" value={tolerance} onChange={(event) => setTolerance(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" /></label>
        </div>
        <div className="mt-3 space-y-2">
           {components.map((component, index) => (
             <div key={index} className="rounded-md border border-gray-200 bg-white p-2">
               <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
               <select aria-label={`Componente ${index + 1}`} value={component.componentProductId} onChange={(event) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, componentProductId: event.target.value } : item))} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"><option value="" className="text-gray-900">Seleccionar componente...</option>{products.filter((product) => product.stockControl.toUpperCase() === "SI" && product.id !== source?.product.id).map((product) => <option key={product.id} value={product.id} className="text-gray-900">{product.code} · {product.posDescription} ({product.baseStockUnit})</option>)}</select>
               <input aria-label={`Cantidad componente ${index + 1}`} type="text" inputMode="decimal" placeholder="Cantidad" value={component.quantityPerUnit} onChange={(event) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantityPerUnit: event.target.value } : item))} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
               <button type="button" aria-label={`Eliminar componente ${index + 1}`} disabled={components.length === 1} onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700 disabled:opacity-40">Eliminar</button>
               </div>
               {(() => {
                 const snapshot = estimatedCostResult?.snapshots.find((item) => item.componentProductId === component.componentProductId)
                 return <p className="mt-1 text-xs text-gray-700">Coste unitario: {snapshot == null ? "pendiente" : `${snapshot.unitCostSnapshot.toFixed(4)} €`} · Coste de esta cantidad: {snapshot == null ? "pendiente" : `${snapshot.lineCost.toFixed(4)} €`}</p>
               })()}
             </div>
           ))}
          <button type="button" onClick={() => setComponents((current) => [...current, { componentProductId: "", quantityPerUnit: "" }])} className="text-xs font-medium text-indigo-700">+ Añadir componente</button>
        </div>
      </section>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700">Cancelar</button>
        {isNewRecipe && <button type="button" disabled={saving || requiredOutputMissing || invalidComponents} onClick={() => void submit(false)} className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50">Guardar borrador</button>}
        <button type="button" disabled={saving || requiredOutputMissing || invalidComponents || (!isNewRecipe && (salesVatPercentage == null || salePriceIncludingVat == null || salePriceIncludingVat <= 0))} onClick={() => void submit(isNewRecipe)} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Guardando..." : isNewRecipe ? "Crear y activar" : "Guardar cambios"}</button>
         </div>
         <div className="mt-3 rounded-md border border-indigo-200 bg-white p-3 text-sm text-gray-900">
           <div className="flex items-center justify-between gap-3">
             <span className="font-medium">Coste total de una unidad producida</span>
             <strong>{estimatedCost == null ? "Pendiente" : `${estimatedCost.toFixed(4)} €`}</strong>
           </div>
           <p className="mt-1 text-xs text-gray-600">Suma de cantidad de cada componente × su coste unitario sin IVA.</p>
         </div>
       </div>
  )
}
