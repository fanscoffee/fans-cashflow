"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
}: {
  productos: Producto[]
  value: string
  onSelect: (productoId: string) => void
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
        type="text"
        readOnly
        value={selected ? `${selected.codigo} - ${selected.descripcionTpv}` : ""}
        placeholder="Buscar producto..."
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

  const lineas = watch("lineas")

  useEffect(() => {
    fetch("/api/inventario/proveedores?pageSize=200")
      .then((r) => r.json())
      .then((d) => setProveedores(d.proveedores || []))
      .catch(() => {})
  }, [])

  const loadProductos = useCallback(async () => {
    try {
      const r = await fetch("/api/inventario/recepciones/productos")
      const d = await r.json()
      setProductos(d.productos || [])
    } catch {
      setProductos([])
    }
  }, [])

  useEffect(() => {
    loadProductos()
  }, [loadProductos])

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Proveedor *
          </label>
          <select
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
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Líneas de Producto *</h3>

        {errors.lineas && (
          <p className="mb-2 text-xs text-red-600">{errors.lineas.message || errors.lineas.root?.message}</p>
        )}

        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 w-20">UoM</th>
                <th className="px-3 py-2 w-24">Cantidad</th>
                <th className="px-3 py-2 w-28">Precio Unit.</th>
                <th className="px-3 py-2 w-28">Subtotal</th>
                <th className="px-3 py-2 w-28">Lote</th>
                <th className="px-3 py-2 w-32">Vencimiento</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, index) => {
                const prod = getProductoInfo(lineas?.[index]?.productoId || "")
                const subtotal = (lineas?.[index]?.cantidadRecibida || 0) * (lineas?.[index]?.precioUnitario || 0)
                return (
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <ProductoCombobox
                        productos={productos}
                        value={lineas?.[index]?.productoId || ""}
                        onSelect={(id) => handleProductoChange(index, id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {prod?.umCompra || "\u2014"}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lineas.${index}.cantidadRecibida`)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        {...register(`lineas.${index}.precioUnitario`)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-900">
                      {subtotal.toFixed(2)} EUR
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        {...register(`lineas.${index}.lote`)}
                        placeholder="Opcional"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        {...register(`lineas.${index}.fechaVencimiento`)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          X
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddLinea}
            className="rounded-md border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            + Agregar linea
          </button>
          <div className="text-sm font-semibold text-gray-900">
            Total: {totalRecepcion.toFixed(2)} EUR
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Registrar recepcion"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
