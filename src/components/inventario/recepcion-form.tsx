"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface Proveedor {
  id: string
  razonSocial: string
}

interface Producto {
  id: string
  codigo: string
  descripcionTpv: string
  umCompra: string
  costeUmBase: number | null
}

const lineaSchema = z.object({
  productoId: z.string().min(1, "Selecciona un producto"),
  cantidadRecibida: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio no puede ser negativo"),
  lote: z.string().optional(),
  fechaVencimiento: z.string().optional(),
})

const recepcionSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona un proveedor"),
  codigoAlbaran: z.string().min(1, "El código de albarán es obligatorio"),
  fechaRecepcion: z.string().min(1, "La fecha es obligatoria"),
  notas: z.string().optional(),
  lineas: z
    .array(lineaSchema)
    .min(1, "Agrega al menos una línea de producto"),
})

type FormValues = z.infer<typeof recepcionSchema>

function todayString() {
  return new Date().toISOString().split("T")[0]
}

function ProductoCombobox({
  productos,
  value,
  onSelect,
  id,
  disabled = false,
  placeholder = "Buscar producto...",
}: {
  productos: Producto[]
  value: string
  onSelect: (productoId: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = productos.find((p) => p.id === value)

  const filtered = productos.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.codigo.toLowerCase().includes(q) ||
      p.descripcionTpv.toLowerCase().includes(q)
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
        value={selected ? `${selected.codigo} - ${selected.descripcionTpv}` : ""}
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
                <span className="font-mono">{p.codigo}</span>{" "}
                <span className="text-gray-600">{p.descripcionTpv}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function RecepcionForm({
  onSubmit,
  onCancel,
  saving,
}: {
  onSubmit: (data: FormValues) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const {
    register,
    handleSubmit,
    control,
    getValues,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(recepcionSchema) as Resolver<FormValues>,
    defaultValues: {
      proveedorId: "",
      codigoAlbaran: "",
      fechaRecepcion: todayString(),
      notas: "",
      lineas: [{ productoId: "", cantidadRecibida: 1, precioUnitario: 0, lote: "", fechaVencimiento: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineas",
  })

  const proveedorId = watch("proveedorId")
  const lineas = watch("lineas")
  const [productosLoading, setProductosLoading] = useState(false)
  const previousProveedorId = useRef("")

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setProveedores(d.proveedores || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const previousId = previousProveedorId.current
    previousProveedorId.current = proveedorId

    if (previousId && previousId !== proveedorId) {
      getValues("lineas").forEach((_, index) => {
        setValue(`lineas.${index}.productoId`, "")
        setValue(`lineas.${index}.precioUnitario`, 0)
        setValue(`lineas.${index}.lote`, "")
        setValue(`lineas.${index}.fechaVencimiento`, "")
      })
    }

    if (!proveedorId) {
      setProductos([])
      setProductosLoading(false)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ proveedorId })
    setProductos([])
    setProductosLoading(true)

    fetch(`/api/inventario/recepciones/productos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Error al cargar productos")
        return response.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) setProductos(data.productos || [])
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return
        if (!controller.signal.aborted) setProductos([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductosLoading(false)
      })

    return () => controller.abort()
  }, [getValues, proveedorId, setValue])

  const handleAddLinea = () => {
    append({ productoId: "", cantidadRecibida: 1, precioUnitario: 0, lote: "", fechaVencimiento: "" })
  }

  const handleProductoChange = (index: number, productoId: string) => {
    setValue(`lineas.${index}.productoId`, productoId)
    const prod = productos.find((p) => p.id === productoId)
    if (prod?.costeUmBase != null) {
      setValue(`lineas.${index}.precioUnitario`, Number(prod.costeUmBase))
    }
  }

  const getProductoInfo = (productoId: string) => {
    return productos.find((p) => p.id === productoId)
  }

  const totalRecepcion = (lineas || []).reduce((sum, l) => {
    return sum + (l.cantidadRecibida || 0) * (l.precioUnitario || 0)
  }, 0)
  const productoPlaceholder = !proveedorId
    ? "Selecciona primero un proveedor..."
    : productosLoading
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
            {...register("proveedorId")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial}
              </option>
            ))}
          </select>
          {errors.proveedorId && (
            <p className="mt-1 text-xs text-red-600">{errors.proveedorId.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Código de Albarán *
          </label>
          <input
            type="text"
            {...register("codigoAlbaran")}
            placeholder="Ej: ALB-2026-00123"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.codigoAlbaran && (
            <p className="mt-1 text-xs text-red-600">{errors.codigoAlbaran.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Fecha de Recepción *
          </label>
          <input
            type="date"
            {...register("fechaRecepcion")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.fechaRecepcion && (
            <p className="mt-1 text-xs text-red-600">{errors.fechaRecepcion.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notas
          </label>
          <input
            type="text"
            {...register("notas")}
            placeholder="Observaciones opcionales..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Líneas de Producto *</h3>
        <p className="mb-3 text-xs text-gray-500">Añade una tarjeta por cada producto que figure en el albarán.</p>

        {errors.lineas && (
          <p className="mb-2 text-xs text-red-600">{errors.lineas.message || errors.lineas.root?.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const prod = getProductoInfo(lineas?.[index]?.productoId || "")
            const subtotal = (lineas?.[index]?.cantidadRecibida || 0) * (lineas?.[index]?.precioUnitario || 0)
            const productoId = `recepcion-producto-${field.id}`
            const cantidadId = `recepcion-cantidad-${field.id}`
            const precioId = `recepcion-precio-${field.id}`
            const loteId = `recepcion-lote-${field.id}`
            const vencimientoId = `recepcion-vencimiento-${field.id}`

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
                    <label htmlFor={productoId} className="mb-1 block text-xs font-medium text-gray-600">
                      Producto *
                    </label>
                    <ProductoCombobox
                      id={productoId}
                      productos={productos}
                      value={lineas?.[index]?.productoId || ""}
                      onSelect={(id) => handleProductoChange(index, id)}
                      disabled={!proveedorId || productosLoading}
                      placeholder={productoPlaceholder}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">UoM</span>
                      <div className="flex min-h-11 items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {prod?.umCompra || "\u2014"}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={cantidadId} className="mb-1 block text-xs font-medium text-gray-600">
                        Cantidad recibida *
                      </label>
                      <input
                        id={cantidadId}
                        type="number"
                        step="0.01"
                        {...register(`lineas.${index}.cantidadRecibida`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={precioId} className="mb-1 block text-xs font-medium text-gray-600">
                        Precio unitario
                      </label>
                      <input
                        id={precioId}
                        type="number"
                        step="0.0001"
                        {...register(`lineas.${index}.precioUnitario`)}
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
                      <label htmlFor={loteId} className="mb-1 block text-xs font-medium text-gray-600">
                        Lote
                      </label>
                      <input
                        id={loteId}
                        type="text"
                        {...register(`lineas.${index}.lote`)}
                        placeholder="Opcional"
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={vencimientoId} className="mb-1 block text-xs font-medium text-gray-600">
                        Vencimiento
                      </label>
                      <input
                        id={vencimientoId}
                        type="date"
                        {...register(`lineas.${index}.fechaVencimiento`)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )
          })}
        </div>

        {proveedorId && !productosLoading && productos.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Este proveedor no tiene productos comprables activos asociados.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <button
            type="button"
            onClick={handleAddLinea}
            className="min-h-11 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            + Agregar línea
          </button>
          <div className="text-right text-sm font-semibold text-gray-900">
            Total: {totalRecepcion.toFixed(2)} EUR
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
