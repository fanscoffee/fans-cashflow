"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface Supplier {
  id: string
  legalName: string
}

interface Product {
  id: string
  code: string
  posDescription: string
  purchaseUnit: string
  baseUnitCost: number | null
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
  lines: z
    .array(lineSchema)
    .min(1, "Agrega al menos una línea de producto"),
})

type FormValues = z.infer<typeof receiptSchema>

function todayString() {
  return new Date().toISOString().split("T")[0]
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
}: {
  onSubmit: (data: FormValues) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const {
    register,
    handleSubmit,
    control,
    getValues,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(receiptSchema) as Resolver<FormValues>,
    defaultValues: {
      supplierId: "",
      deliveryNoteCode: "",
      receivedAt: todayString(),
      notes: "",
      lines: [{ productId: "", receivedQuantity: 1, unitPrice: 0, batch: "", dueDate: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  const supplierId = watch("supplierId")
  const lines = watch("lines")
  const [productsLoading, setProductsLoading] = useState(false)
  const previousSupplierId = useRef("")

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const previousId = previousSupplierId.current
    previousSupplierId.current = supplierId

    if (previousId && previousId !== supplierId) {
      getValues("lines").forEach((_, index) => {
        setValue(`lines.${index}.productId`, "")
        setValue(`lines.${index}.unitPrice`, 0)
        setValue(`lines.${index}.batch`, "")
        setValue(`lines.${index}.dueDate`, "")
      })
    }

    if (!supplierId) {
      setProducts([])
      setProductsLoading(false)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ supplierId })
    setProducts([])
    setProductsLoading(true)

    fetch(`/api/inventario/recepciones/productos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Error al cargar productos")
        return response.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) setProducts(data.products || [])
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

  const handleAddLine = () => {
    append({ productId: "", receivedQuantity: 1, unitPrice: 0, batch: "", dueDate: "" })
  }

  const handleProductChange = (index: number, productId: string) => {
    setValue(`lines.${index}.productId`, productId)
    const prod = products.find((p) => p.id === productId)
    if (prod?.baseUnitCost != null) {
      setValue(`lines.${index}.unitPrice`, Number(prod.baseUnitCost))
    }
  }

  const getProductInfo = (productId: string) => {
    return products.find((p) => p.id === productId)
  }

  const totalReceipt = (lines || []).reduce((sum, l) => {
    return sum + (l.receivedQuantity || 0) * (l.unitPrice || 0)
  }, 0)
  const productPlaceholder = !supplierId
    ? "Selecciona primero un proveedor..."
    : productsLoading
      ? "Cargando productos..."
      : "Buscar producto..."

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            const subtotal = (lines?.[index]?.receivedQuantity || 0) * (lines?.[index]?.unitPrice || 0)
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
                      onClick={() => remove(index)}
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
                        Precio unitario
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
                      <span className="mb-1 block text-xs font-medium text-gray-600">Subtotal</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900">
                        {subtotal.toFixed(2)} EUR
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
          <div className="text-right text-sm font-semibold text-gray-900">
            Total: {totalReceipt.toFixed(2)} EUR
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Guardando..." : "Registrar recepcion"}
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
