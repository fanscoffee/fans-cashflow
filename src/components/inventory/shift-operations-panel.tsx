"use client"

import { useState } from "react"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

type ProductOption = {
  id: string
  code: string
  posDescription: string
  baseStockUnit: string
  stockControl: string
  recipe: {
    versions: Array<{
      id: string
      version: number
      tolerancePercentage: number | string
      components: Array<{
        componentProductId: string
        quantityPerUnit: number | string
        componentProduct: { code: string; posDescription: string; baseStockUnit: string }
      }>
    }>
  } | null
}

type OperationData = {
  shift: { status: string; operationalReview?: { id: string } | null } | null
  products: ProductOption[]
  reasons: Array<{ id: string; code: string; name: string }>
  balances: Array<{ productId: string; quantity: number | string }>
  productions: Array<{
    id: string
    quantity: number | string
    status: string
    product: { code: string; posDescription: string; baseStockUnit: string }
    createdBy: { name: string | null; email: string }
  }>
  waste: Array<{
    id: string
    quantity: number | string
    status: string
    product: { code: string; posDescription: string; baseStockUnit: string }
    reason: { name: string }
    createdBy: { name: string | null; email: string }
  }>
}

export function ShiftOperationsPanel({ shiftId, isOpen, userRole, onChanged }: {
  shiftId?: string
  isOpen: boolean
  userRole?: string
  onChanged?: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<OperationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState<"production" | "waste" | "stock" | null>(null)
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [exceptionReason, setExceptionReason] = useState("")
  const [deviationReason, setDeviationReason] = useState("")
  const [actuals, setActuals] = useState<Record<string, string>>({})
  const [reasonId, setReasonId] = useState("")
  const [notes, setNotes] = useState("")
  const [allowNegative, setAllowNegative] = useState(false)
  const [standaloneReason, setStandaloneReason] = useState("")
  const canOverrideStock = hasAnyRole(userRole, [UserRole.ADMIN, UserRole.PARTNER])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(shiftId ? `/api/inventario/operaciones?shiftId=${encodeURIComponent(shiftId)}` : "/api/inventario/operaciones")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo cargar el control operativo")
      setData(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el control operativo")
    } finally {
      setLoading(false)
    }
  }

  async function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !data) await load()
  }

  function resetForm() {
    setForm(null)
    setProductId("")
    setQuantity("")
    setExceptionReason("")
    setDeviationReason("")
    setActuals({})
    setReasonId("")
    setNotes("")
    setAllowNegative(false)
    setStandaloneReason("")
  }

  const selectedProduct = data?.products.find((product) => product.id === productId)
  const recipe = selectedProduct?.recipe?.versions[0]
  const producedQuantity = Number(quantity) || 0
  const balanceByProduct = new Map(data?.balances.map((balance) => [balance.productId, Number(balance.quantity)]) || [])

  async function submitProduction() {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inventario/produccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shiftId || undefined,
          productId,
          quantity: producedQuantity,
          exceptionReason: recipe ? undefined : exceptionReason,
          deviationReason: deviationReason || undefined,
          allowNegative: canOverrideStock ? allowNegative : undefined,
          standaloneReason: shiftId ? undefined : standaloneReason,
          actualConsumptions: recipe?.components.map((component) => ({
            componentProductId: component.componentProductId,
            quantity: actuals[component.componentProductId] === undefined || actuals[component.componentProductId] === ""
              ? Number(component.quantityPerUnit) * producedQuantity
              : Number(actuals[component.componentProductId]),
          })),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar la producción")
      resetForm()
      await load()
      await onChanged?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la producción")
    } finally {
      setSaving(false)
    }
  }

  async function submitWaste() {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inventario/mermas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shiftId || undefined,
          productId,
          reasonId,
          quantity: Number(quantity),
          notes: notes || undefined,
          allowNegative: canOverrideStock ? allowNegative : undefined,
          standaloneReason: shiftId ? undefined : standaloneReason,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo registrar la merma")
      resetForm()
      await load()
      await onChanged?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la merma")
    } finally {
      setSaving(false)
    }
  }

  async function submitStockAdjustment() {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inventario/existencias/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, targetQuantity: Number(quantity), reason: standaloneReason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo ajustar la existencia")
      resetForm()
      await load()
      await onChanged?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ajustar la existencia")
    } finally {
      setSaving(false)
    }
  }

  async function runRecordAction(url: string, reason?: string) {
    setSaving(true)
    setError("")
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reason === undefined ? undefined : JSON.stringify({ reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo completar la operación")
      await load()
      await onChanged?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo completar la operación")
    } finally {
      setSaving(false)
    }
  }

  function reverseRecord(kind: "produccion" | "mermas", id: string) {
    const reason = window.prompt("Indica el motivo de la reversa")?.trim()
    if (!reason) return
    void runRecordAction(`/api/inventario/${kind}/${id}/reversar`, reason)
  }

  return (
    <div className="mt-3 border-t border-amber-200 pt-3">
      <button type="button" onClick={() => void toggle()} className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-900">
        <span>{shiftId ? "Producción y mermas" : "Operaciones fuera de turno"}</span>
        <span className="text-xs font-normal text-gray-500">{expanded ? "Ocultar" : "Gestionar"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading && <p className="text-xs text-gray-500">Cargando control operativo...</p>}
          {error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-blue-50 p-2 text-center">
                  <p className="text-lg font-semibold text-blue-900">{data.productions.filter((item) => item.status !== "REVERSED").length}</p>
                  <p className="text-xs text-blue-700">Elaboraciones</p>
                </div>
                <div className="rounded-md bg-rose-50 p-2 text-center">
                  <p className="text-lg font-semibold text-rose-900">{data.waste.filter((item) => item.status !== "REVERSED").length}</p>
                  <p className="text-xs text-rose-700">Mermas</p>
                </div>
              </div>

              {shiftId && data.shift?.operationalReview && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">El control operativo de este turno ya fue cerrado. Las correcciones deben realizarse mediante reversas o fuera de turno.</p>
              )}

              {isOpen && !data.shift?.operationalReview && !form && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setForm("production")} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">+ Registrar producción</button>
                  <button type="button" onClick={() => setForm("waste")} className="rounded-md bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700">+ Registrar merma</button>
                  {!shiftId && <button type="button" onClick={() => setForm("stock")} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800">Ajustar existencia</button>}
                </div>
              )}

              {isOpen && !data.shift?.operationalReview && form && (
                <div className="rounded-md border bg-white p-3">
                  <h4 className="text-sm font-semibold text-gray-900">{form === "production" ? "Nueva producción" : form === "waste" ? "Nueva merma" : "Ajuste de existencia"}</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-700">
                      Producto
                      <select value={productId} onChange={(event) => { setProductId(event.target.value); setActuals({}) }} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
                        <option value="">Seleccionar...</option>
                        {data.products.filter((product) => form === "production" || product.stockControl.toUpperCase() === "SI").map((product) => (
                          <option key={product.id} value={product.id}>{product.code} · {product.posDescription}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-gray-700">
                      {form === "stock" ? "Existencia objetivo" : "Cantidad"} {selectedProduct ? `(${selectedProduct.baseStockUnit})` : ""}
                      <input type="number" min="0" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
                    </label>
                  </div>

                  {form === "production" && selectedProduct && !recipe && (
                    <label className="mt-3 block text-xs text-gray-700">
                      Justificación por no tener receta
                      <textarea value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
                    </label>
                  )}

                  {form === "production" && recipe && producedQuantity > 0 && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-800">Consumo por receta v{recipe.version}</p>
                      <div className="mt-2 space-y-2">
                        {recipe.components.map((component) => {
                          const theoretical = Number(component.quantityPerUnit) * producedQuantity
                          return (
                            <label key={component.componentProductId} className="grid grid-cols-[1fr_7rem] items-center gap-2 text-xs text-gray-700">
                              <span>{component.componentProduct.code} · teórico {theoretical.toFixed(4)} {component.componentProduct.baseStockUnit} · stock {Number(balanceByProduct.get(component.componentProductId) || 0).toFixed(4)}</span>
                              <input aria-label={`Consumo real ${component.componentProduct.code}`} type="number" min="0" step="0.0001" placeholder={theoretical.toFixed(4)} value={actuals[component.componentProductId] || ""} onChange={(event) => setActuals((current) => ({ ...current, [component.componentProductId]: event.target.value }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
                            </label>
                          )
                        })}
                      </div>
                      <label className="mt-3 block text-xs text-gray-700">
                        Motivo del desvío, si modificas consumos
                        <input value={deviationReason} onChange={(event) => setDeviationReason(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
                      </label>
                    </div>
                  )}

                  {form === "waste" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-gray-700">
                        Motivo
                        <select value={reasonId} onChange={(event) => setReasonId(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
                          <option value="">Seleccionar...</option>
                          {data.reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-gray-700 sm:col-span-2">
                        Observación
                        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
                      </label>
                    </div>
                  )}

                  {canOverrideStock && (
                    <label className="mt-3 flex items-center gap-2 text-xs text-amber-800">
                      <input type="checkbox" checked={allowNegative} onChange={(event) => setAllowNegative(event.target.checked)} />
                      Autorizar stock negativo si no hay existencia suficiente
                    </label>
                  )}

                  {!shiftId && (
                    <label className="mt-3 block text-xs text-gray-700">
                      {form === "stock" ? "Motivo del ajuste" : "Motivo de carga fuera de turno"}
                      <textarea value={standaloneReason} onChange={(event) => setStandaloneReason(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
                    </label>
                  )}

                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={resetForm} className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700">Cancelar</button>
                    <button type="button" disabled={saving || !productId || (form === "stock" ? !(Number(quantity) >= 0) : !(Number(quantity) > 0)) || (form === "waste" && !reasonId) || (!shiftId && !standaloneReason.trim())} onClick={() => void (form === "production" ? submitProduction() : form === "waste" ? submitWaste() : submitStockAdjustment())} className="rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{saving ? "Guardando..." : "Confirmar"}</button>
                  </div>
                </div>
              )}

              {(data.productions.length > 0 || data.waste.length > 0) && (
                <div className="space-y-1 text-xs text-gray-700">
                  {data.productions.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 rounded-md bg-blue-50/60 p-2 sm:flex-row sm:items-center sm:justify-between">
                      <p><strong>Producción:</strong> {item.product.code} · {Number(item.quantity).toFixed(4)} {item.product.baseStockUnit} · {item.status}</p>
                      {canOverrideStock && item.status !== "REVERSED" && (
                        <div className="flex gap-1">
                          {item.status === "REVIEW_REQUIRED" && <button type="button" disabled={saving} onClick={() => void runRecordAction(`/api/inventario/produccion/${item.id}/aprobar`)} className="rounded bg-green-700 px-2 py-1 text-white disabled:opacity-50">Aprobar</button>}
                          <button type="button" disabled={saving} onClick={() => reverseRecord("produccion", item.id)} className="rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-50">Reversar</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {data.waste.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 rounded-md bg-rose-50/60 p-2 sm:flex-row sm:items-center sm:justify-between">
                      <p><strong>Merma:</strong> {item.product.code} · {Number(item.quantity).toFixed(4)} {item.product.baseStockUnit} · {item.reason.name} · {item.status}</p>
                      {canOverrideStock && item.status !== "REVERSED" && <button type="button" disabled={saving} onClick={() => reverseRecord("mermas", item.id)} className="self-start rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-50">Reversar</button>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
