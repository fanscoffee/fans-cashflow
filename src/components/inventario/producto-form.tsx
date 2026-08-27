"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm, type UseFormRegister } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const productoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  codBarrasEan: z.string().optional(),
  descripcionTpv: z.string().min(1, "La descripción TPV es obligatoria"),
  descripcionCompleta: z.string().min(1, "La descripción completa es obligatoria"),
  tipoArticulo: z.string().min(1, "El tipo de artículo es obligatorio"),
  familia: z.string().min(1, "La familia es obligatoria"),
  subfamilia: z.string().optional(),
  seccion: z.string().min(1, "La sección es obligatoria"),
  esComprable: z.boolean(),
  esElaborado: z.boolean(),
  esVendible: z.boolean(),
  llevaReceta: z.boolean(),
  umBaseStock: z.string().min(1, "La UM base es obligatoria"),
  umCompra: z.string().optional(),
  factorCompraABase: z.coerce.number().optional(),
  umVenta: z.string().optional(),
  factorVentaABase: z.coerce.number().optional(),
  pesoNetoUdG: z.coerce.number().optional(),
  formatoPresentacion: z.string().optional(),
  costeUmBase: z.coerce.number().optional(),
  mermaEstandarPct: z.coerce.number().optional(),
  codIva: z.string().min(1, "El código IVA es obligatorio"),
  ivaPct: z.coerce.number().optional(),
  metodoPrecio: z.string().min(1, "El método de precio es obligatorio"),
  margenObjetivoPct: z.coerce.number().optional(),
  pvpObjetivoConIva: z.coerce.number().optional(),
  pvpFijoConIva: z.coerce.number().optional(),
  pvpAplicadoConIva: z.coerce.number().optional(),
  pvpAplicadoSinIva: z.coerce.number().optional(),
  margenRealPct: z.coerce.number().optional(),
  desviacionPp: z.coerce.number().optional(),
  diferenciaEurUd: z.coerce.number().optional(),
  diagnosticoPrecio: z.string().optional(),
  controlaStock: z.string().min(1, "Control de stock obligatorio"),
  metodoValoracion: z.string().min(1, "Método de valoración obligatorio"),
  stockMinimo: z.coerce.number().optional(),
  stockMaximo: z.coerce.number().optional(),
  puntoPedido: z.coerce.number().optional(),
  ubicacion: z.string().optional(),
  claseAbc: z.string().optional(),
  controlLote: z.string().min(1, "Control de lote obligatorio"),
  vidaUtilDias: z.coerce.number().int().optional(),
  conservacion: z.string().optional(),
  alergenos: z.string().optional(),
  estado: z.string().min(1, "El estado es obligatorio"),
  observaciones: z.string().optional(),
})

type ProductoFormValues = z.infer<typeof productoSchema>

interface Producto {
  id: string
  codigo: string
  codBarrasEan: string | null
  descripcionTpv: string
  descripcionCompleta: string
  tipoArticulo: string
  familia: string
  subfamilia: string | null
  seccion: string
  esComprable: boolean
  esElaborado: boolean
  esVendible: boolean
  llevaReceta: boolean
  umBaseStock: string
  umCompra: string | null
  factorCompraABase: number | null
  umVenta: string | null
  factorVentaABase: number | null
  pesoNetoUdG: number | null
  formatoPresentacion: string | null
  costeUmBase: number | null
  mermaEstandarPct: number | null
  codIva: string
  ivaPct: number | null
  metodoPrecio: string
  margenObjetivoPct: number | null
  pvpObjetivoConIva: number | null
  pvpFijoConIva: number | null
  pvpAplicadoConIva: number | null
  pvpAplicadoSinIva: number | null
  margenRealPct: number | null
  desviacionPp: number | null
  diferenciaEurUd: number | null
  diagnosticoPrecio: string | null
  controlaStock: string
  metodoValoracion: string
  stockMinimo: number | null
  stockMaximo: number | null
  puntoPedido: number | null
  ubicacion: string | null
  claseAbc: string | null
  controlLote: string
  vidaUtilDias: number | null
  conservacion: string | null
  alergenos: string | null
  estado: string
  fechaAlta: string
  observaciones: string | null
  esEjemplo: boolean
}

interface CatalogoItem {
  id: string
  tipo: string
  valor: string
  descripcion: string | null
}

interface ProductoFormProps {
  initialValues?: Producto
  onSubmit: (data: ProductoFormValues) => Promise<boolean>
  onCancel: () => void
  saving: boolean
}

function defaultValues(): ProductoFormValues {
  return {
    codigo: "",
    codBarrasEan: "",
    descripcionTpv: "",
    descripcionCompleta: "",
    tipoArticulo: "",
    familia: "",
    subfamilia: "",
    seccion: "",
    esComprable: false,
    esElaborado: false,
    esVendible: false,
    llevaReceta: false,
    umBaseStock: "",
    umCompra: "",
    factorCompraABase: undefined,
    umVenta: "",
    factorVentaABase: undefined,
    pesoNetoUdG: undefined,
    formatoPresentacion: "",
    costeUmBase: undefined,
    mermaEstandarPct: undefined,
    codIva: "",
    ivaPct: undefined,
    metodoPrecio: "",
    margenObjetivoPct: undefined,
    pvpObjetivoConIva: undefined,
    pvpFijoConIva: undefined,
    pvpAplicadoConIva: undefined,
    pvpAplicadoSinIva: undefined,
    margenRealPct: undefined,
    desviacionPp: undefined,
    diferenciaEurUd: undefined,
    diagnosticoPrecio: "",
    controlaStock: "SI",
    metodoValoracion: "",
    stockMinimo: undefined,
    stockMaximo: undefined,
    puntoPedido: undefined,
    ubicacion: "",
    claseAbc: "",
    controlLote: "NO",
    vidaUtilDias: undefined,
    conservacion: "",
    alergenos: "",
    estado: "Activo",
    observaciones: "",
  }
}

function toFormValues(producto: Producto): ProductoFormValues {
  const vals = defaultValues()
  const keys = Object.keys(vals) as (keyof ProductoFormValues)[]
  for (const key of keys) {
    const v = (producto as unknown as Record<string, unknown>)[key]
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
}: {
  label: string
  name: keyof ProductoFormValues
  register: UseFormRegister<ProductoFormValues>
  options: CatalogoItem[]
  placeholder: string
  error?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        {...register(name)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.valor}>
            {opt.descripcion || opt.valor}
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
}: {
  label: string
  name: keyof ProductoFormValues
  register: UseFormRegister<ProductoFormValues>
  placeholder: string
  error?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        {...register(name)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  name: keyof ProductoFormValues
  register: UseFormRegister<ProductoFormValues>
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

function CheckboxField({
  label,
  name,
  register,
}: {
  label: string
  name: keyof ProductoFormValues
  register: UseFormRegister<ProductoFormValues>
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        {...register(name)}
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

export default function ProductoForm({
  initialValues,
  onSubmit,
  onCancel,
  saving,
}: ProductoFormProps) {
  const isEditing = !!initialValues

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema) as Resolver<ProductoFormValues>,
    defaultValues: initialValues ? toFormValues(initialValues) : defaultValues(),
  })

  useEffect(() => {
    reset(initialValues ? toFormValues(initialValues) : defaultValues())
  }, [initialValues, reset])

  const [catalogos, setCatalogos] = useState<Record<string, CatalogoItem[]>>({})

  const loadCatalogo = useCallback(async (tipo: string) => {
    if (catalogos[tipo]) return
    try {
      const res = await fetch(`/api/inventario/catalogos?tipo=${encodeURIComponent(tipo)}`)
      if (res.ok) {
        const data = await res.json()
        setCatalogos((prev) => ({ ...prev, [tipo]: data }))
      }
    } catch { /* empty */ }
  }, [catalogos])

  useEffect(() => {
    const tipos = [
      "TIPO_ARTICULO", "FAMILIA", "SUBFAMILIA", "SECCION", "UNIDAD_MEDIDA",
      "SI_NO", "VALORACION", "METODO_PRECIO", "CLASE_ABC", "UBICACION",
      "CONSERVACION", "ESTADO", "CODIGO_IVA", "PROVEEDOR",
    ]
    tipos.forEach(loadCatalogo)
  }, [loadCatalogo])

  async function handleFormSubmit(data: ProductoFormValues) {
    const ok = await onSubmit(data)
    if (ok && !isEditing) reset(defaultValues())
  }

  const cat = (tipo: string) => catalogos[tipo] || []

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Section title="Identificación" defaultOpen>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Código *" name="codigo" register={register} placeholder="MP-HAR-001" error={errors.codigo?.message} />
          <TextField label="Código de barras EAN" name="codBarrasEan" register={register} placeholder="8412345678901" error={errors.codBarrasEan?.message} />
          <TextField label="Descripción TPV *" name="descripcionTpv" register={register} placeholder="Harina trigo W180" error={errors.descripcionTpv?.message} />
          <div className="sm:col-span-2">
            <TextField label="Descripción completa *" name="descripcionCompleta" register={register} placeholder="Harina trigo W180 saco 25 kg" error={errors.descripcionCompleta?.message} />
          </div>
        </div>
      </Section>

      <Section title="Clasificación">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Tipo de artículo *" name="tipoArticulo" register={register} options={cat("TIPO_ARTICULO")} placeholder="Seleccionar tipo..." error={errors.tipoArticulo?.message} />
          <CatalogSelect label="Familia *" name="familia" register={register} options={cat("FAMILIA")} placeholder="Seleccionar familia..." error={errors.familia?.message} />
          <CatalogSelect label="Subfamilia" name="subfamilia" register={register} options={cat("SUBFAMILIA")} placeholder="Seleccionar subfamilia..." error={errors.subfamilia?.message} />
          <CatalogSelect label="Sección *" name="seccion" register={register} options={cat("SECCION")} placeholder="Seleccionar sección..." error={errors.seccion?.message} />
          <div className="flex flex-wrap gap-6 pt-2">
            <CheckboxField label="Es comprable" name="esComprable" register={register} />
            <CheckboxField label="Es elaborado" name="esElaborado" register={register} />
            <CheckboxField label="Es vendible" name="esVendible" register={register} />
            <CheckboxField label="Lleva receta" name="llevaReceta" register={register} />
          </div>
        </div>
      </Section>

      <Section title="Unidades de medida">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="UM base stock *" name="umBaseStock" register={register} options={cat("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.umBaseStock?.message} />
          <CatalogSelect label="UM compra" name="umCompra" register={register} options={cat("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.umCompra?.message} />
          <NumberField label="Factor compra a base" name="factorCompraABase" register={register} placeholder="25" error={errors.factorCompraABase?.message} />
          <CatalogSelect label="UM venta" name="umVenta" register={register} options={cat("UNIDAD_MEDIDA")} placeholder="Seleccionar unidad..." error={errors.umVenta?.message} />
          <NumberField label="Factor venta a base" name="factorVentaABase" register={register} placeholder="1" error={errors.factorVentaABase?.message} />
          <NumberField label="Peso neto ud (g)" name="pesoNetoUdG" register={register} placeholder="250" error={errors.pesoNetoUdG?.message} />
          <div className="sm:col-span-2">
            <TextField label="Formato presentación" name="formatoPresentacion" register={register} placeholder="Saco 25 kg" error={errors.formatoPresentacion?.message} />
          </div>
        </div>
      </Section>

      <Section title="Costes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="Coste UM base (€)" name="costeUmBase" register={register} placeholder="0.74" error={errors.costeUmBase?.message} />
          <NumberField label="Merma estándar (%)" name="mermaEstandarPct" register={register} placeholder="1.0" error={errors.mermaEstandarPct?.message} />
        </div>
      </Section>

      <Section title="Fiscal y precios">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Código IVA *" name="codIva" register={register} options={cat("CODIGO_IVA")} placeholder="Seleccionar código..." error={errors.codIva?.message} />
          <NumberField label="IVA %" name="ivaPct" register={register} placeholder="4" error={errors.ivaPct?.message} />
          <CatalogSelect label="Método precio *" name="metodoPrecio" register={register} options={cat("METODO_PRECIO")} placeholder="Seleccionar método..." error={errors.metodoPrecio?.message} />
          <NumberField label="Margen objetivo %" name="margenObjetivoPct" register={register} placeholder="70" error={errors.margenObjetivoPct?.message} />
          <NumberField label="PVP objetivo con IVA (€)" name="pvpObjetivoConIva" register={register} placeholder="1.19" error={errors.pvpObjetivoConIva?.message} />
          <NumberField label="PVP fijo con IVA (€)" name="pvpFijoConIva" register={register} placeholder="1.20" error={errors.pvpFijoConIva?.message} />
          <NumberField label="PVP aplicado con IVA (€)" name="pvpAplicadoConIva" register={register} placeholder="1.20" error={errors.pvpAplicadoConIva?.message} />
          <NumberField label="PVP aplicado sin IVA (€)" name="pvpAplicadoSinIva" register={register} placeholder="1.15" error={errors.pvpAplicadoSinIva?.message} />
          <NumberField label="Margen real %" name="margenRealPct" register={register} placeholder="69.65" error={errors.margenRealPct?.message} />
          <NumberField label="Desviación (pp)" name="desviacionPp" register={register} placeholder="-0.35" error={errors.desviacionPp?.message} />
          <NumberField label="Diferencia EUR/ud" name="diferenciaEurUd" register={register} placeholder="0.01" error={errors.diferenciaEurUd?.message} />
          <TextField label="Diagnóstico precio" name="diagnosticoPrecio" register={register} placeholder="EN OBJETIVO" error={errors.diagnosticoPrecio?.message} />
        </div>
      </Section>

      <Section title="Control de inventario">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Controla stock *" name="controlaStock" register={register} options={cat("SI_NO")} placeholder="Seleccionar..." error={errors.controlaStock?.message} />
          <CatalogSelect label="Método valoración *" name="metodoValoracion" register={register} options={cat("VALORACION")} placeholder="Seleccionar método..." error={errors.metodoValoracion?.message} />
          <NumberField label="Stock mínimo" name="stockMinimo" register={register} placeholder="50" error={errors.stockMinimo?.message} />
          <NumberField label="Stock máximo" name="stockMaximo" register={register} placeholder="300" error={errors.stockMaximo?.message} />
          <NumberField label="Punto de pedido" name="puntoPedido" register={register} placeholder="100" error={errors.puntoPedido?.message} />
          <CatalogSelect label="Ubicación" name="ubicacion" register={register} options={cat("UBICACION")} placeholder="Seleccionar ubicación..." error={errors.ubicacion?.message} />
          <CatalogSelect label="Clase ABC" name="claseAbc" register={register} options={cat("CLASE_ABC")} placeholder="Seleccionar clase..." error={errors.claseAbc?.message} />
        </div>
      </Section>

      <Section title="Trazabilidad y estado">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CatalogSelect label="Control de lote *" name="controlLote" register={register} options={cat("SI_NO")} placeholder="Seleccionar..." error={errors.controlLote?.message} />
          <NumberField label="Vida útil (días)" name="vidaUtilDias" register={register} placeholder="180" error={errors.vidaUtilDias?.message} />
          <CatalogSelect label="Conservación" name="conservacion" register={register} options={cat("CONSERVACION")} placeholder="Seleccionar conservación..." error={errors.conservacion?.message} />
          <div className="sm:col-span-2">
            <TextField label="Alérgenos (separados por punto y coma)" name="alergenos" register={register} placeholder="Gluten; Leche; Huevos" error={errors.alergenos?.message} />
          </div>
          <CatalogSelect label="Estado *" name="estado" register={register} options={cat("ESTADO")} placeholder="Seleccionar estado..." error={errors.estado?.message} />
          <div className="sm:col-span-2">
            <TextField label="Observaciones" name="observaciones" register={register} placeholder="Notas internas, condiciones del proveedor, estacionalidad..." error={errors.observaciones?.message} />
          </div>
        </div>
      </Section>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear producto"}
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
