"use client"

import { useState, useEffect } from "react"
import { useForm, type UseFormRegister } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { z } from "zod"

const proveedorSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es obligatoria"),
  cifNif: z.string().min(1, "El CIF/NIF es obligatorio"),
  direccionFiscal: z.string().optional(),
  contactoNombre: z.string().optional(),
  contactoTelefono: z.string().optional(),
  contactoEmail: z.string().optional(),
  iban: z.string().optional(),
  categoriaServicio: z.string().optional(),
  condicionesPago: z.string().optional(),
  plazoEntregaDias: z.coerce.number().int().optional(),
  pedidoMinimo: z.coerce.number().optional(),
  notasCondiciones: z.string().optional(),
  frecuenciaEntrega: z.string().optional(),
  horarioEntrega: z.string().optional(),
  metodoPedido: z.string().optional(),
  estado: z.string().min(1, "El estado es obligatorio"),
  valoracionFiabilidad: z.coerce.number().int().min(1).max(5).optional(),
  valoracionCalidad: z.coerce.number().int().min(1).max(5).optional(),
  valoracionPrecio: z.coerce.number().int().min(1).max(5).optional(),
  incidencias: z.string().optional(),
  observaciones: z.string().optional(),
})

type ProveedorFormValues = z.infer<typeof proveedorSchema>

interface Proveedor {
  id: string
  razonSocial: string
  cifNif: string
  direccionFiscal: string | null
  contactoNombre: string | null
  contactoTelefono: string | null
  contactoEmail: string | null
  iban: string | null
  categoriaServicio: string | null
  condicionesPago: string | null
  plazoEntregaDias: number | null
  pedidoMinimo: number | null
  notasCondiciones: string | null
  frecuenciaEntrega: string | null
  horarioEntrega: string | null
  metodoPedido: string | null
  estado: string
  valoracionFiabilidad: number | null
  valoracionCalidad: number | null
  valoracionPrecio: number | null
  incidencias: string | null
  observaciones: string | null
}

interface ProveedorFormProps {
  initialValues?: Proveedor
  onSubmit: (data: ProveedorFormValues) => Promise<boolean>
  onCancel: () => void
  saving: boolean
}

function defaultValues(): ProveedorFormValues {
  return {
    razonSocial: "",
    cifNif: "",
    direccionFiscal: "",
    contactoNombre: "",
    contactoTelefono: "",
    contactoEmail: "",
    iban: "",
    categoriaServicio: "",
    condicionesPago: "",
    plazoEntregaDias: undefined,
    pedidoMinimo: undefined,
    notasCondiciones: "",
    frecuenciaEntrega: "",
    horarioEntrega: "",
    metodoPedido: "",
    estado: "Activo",
    valoracionFiabilidad: undefined,
    valoracionCalidad: undefined,
    valoracionPrecio: undefined,
    incidencias: "",
    observaciones: "",
  }
}

function toFormValues(proveedor: Proveedor): ProveedorFormValues {
  const vals = defaultValues()
  const keys = Object.keys(vals) as (keyof ProveedorFormValues)[]
  for (const key of keys) {
    const v = (proveedor as unknown as Record<string, unknown>)[key]
    if (v !== null && v !== undefined) {
      ;(vals as Record<string, unknown>)[key] = v
    }
  }
  return vals
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

function TextField({
  label,
  name,
  register,
  placeholder,
  error,
  type = "text",
}: {
  label: string
  name: keyof ProveedorFormValues
  register: UseFormRegister<ProveedorFormValues>
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
  name: keyof ProveedorFormValues
  register: UseFormRegister<ProveedorFormValues>
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

function RatingField({
  label,
  name,
  register,
  value,
}: {
  label: string
  name: keyof ProveedorFormValues
  register: UseFormRegister<ProveedorFormValues>
  value?: number | null
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" value={n} {...register(name)} className="sr-only" />
            <span
              className={`inline-block h-7 w-7 rounded-full border text-xs leading-7 text-center ${
                value && value >= n
                  ? "border-yellow-400 bg-yellow-400 text-white"
                  : "border-gray-300 bg-white text-gray-400"
              }`}
            >
              {n}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function TextareaField({
  label,
  name,
  register,
  placeholder,
  error,
}: {
  label: string
  name: keyof ProveedorFormValues
  register: UseFormRegister<ProveedorFormValues>
  placeholder: string
  error?: string
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        {...register(name)}
        placeholder={placeholder}
        rows={3}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function ProveedorForm({
  initialValues,
  onSubmit,
  onCancel,
  saving,
}: ProveedorFormProps) {
  const isEditing = !!initialValues

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema) as Resolver<ProveedorFormValues>,
    defaultValues: initialValues ? toFormValues(initialValues) : defaultValues(),
  })

  useEffect(() => {
    reset(initialValues ? toFormValues(initialValues) : defaultValues())
  }, [initialValues, reset])

  const watchedValues = watch()

  async function handleFormSubmit(data: ProveedorFormValues) {
    const ok = await onSubmit(data)
    if (ok && !isEditing) reset(defaultValues())
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Section title="Identificación y datos fiscales" defaultOpen>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Razón social / nombre comercial *" name="razonSocial" register={register} placeholder="Harinas del Sur S.L." error={errors.razonSocial?.message} />
          <TextField label="CIF/NIF *" name="cifNif" register={register} placeholder="B12345678" error={errors.cifNif?.message} />
          <div className="sm:col-span-2">
            <TextField label="Dirección fiscal" name="direccionFiscal" register={register} placeholder="C/ Industria 45, 41001 Sevilla" error={errors.direccionFiscal?.message} />
          </div>
          <TextField label="Persona de contacto" name="contactoNombre" register={register} placeholder="María García" error={errors.contactoNombre?.message} />
          <TextField label="Teléfono de contacto" name="contactoTelefono" register={register} placeholder="612 345 678" error={errors.contactoTelefono?.message} />
          <TextField label="Email de contacto" name="contactoEmail" register={register} type="email" placeholder="contacto@harinasdelsur.es" error={errors.contactoEmail?.message} />
          <TextField label="IBAN" name="iban" register={register} placeholder="ES91 2100 0418 4502 0005 1332" error={errors.iban?.message} />
        </div>
      </Section>

      <Section title="Datos comerciales">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Categoría de producto/servicio" name="categoriaServicio" register={register} placeholder="Harinas, Lácteos, Café, Envases..." error={errors.categoriaServicio?.message} />
          <TextField label="Condiciones de pago" name="condicionesPago" register={register} placeholder="30 días, Contado, 60 días..." error={errors.condicionesPago?.message} />
          <NumberField label="Plazo de entrega (días)" name="plazoEntregaDias" register={register} placeholder="3" error={errors.plazoEntregaDias?.message} />
          <NumberField label="Pedido mínimo (€)" name="pedidoMinimo" register={register} placeholder="50" error={errors.pedidoMinimo?.message} />
          <div className="sm:col-span-2">
            <TextareaField label="Notas de condiciones (descuentos por volumen, etc.)" name="notasCondiciones" register={register} placeholder="Descuento 5% por compra > 500€, ..."
              error={errors.notasCondiciones?.message} />
          </div>
        </div>
      </Section>

      <Section title="Operativa">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Frecuencia de entrega" name="frecuenciaEntrega" register={register} placeholder="2 veces por semana, Diaria..." error={errors.frecuenciaEntrega?.message} />
          <TextField label="Días y horario de entrega" name="horarioEntrega" register={register} placeholder="Lun-Mié-Vie 7:00-9:00" error={errors.horarioEntrega?.message} />
          <TextField label="Método de pedido" name="metodoPedido" register={register} placeholder="Email, App, Teléfono, Portal web" error={errors.metodoPedido?.message} />
        </div>
      </Section>

      <Section title="Control y evaluación">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado *</label>
            <select
              {...register("estado")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            {errors.estado && <p className="mt-1 text-xs text-red-500">{errors.estado.message}</p>}
          </div>
          <RatingField label="Fiabilidad (1-5)" name="valoracionFiabilidad" register={register} value={watchedValues.valoracionFiabilidad} />
          <RatingField label="Calidad (1-5)" name="valoracionCalidad" register={register} value={watchedValues.valoracionCalidad} />
          <RatingField label="Precio (1-5)" name="valoracionPrecio" register={register} value={watchedValues.valoracionPrecio} />
          <div className="sm:col-span-2">
            <TextareaField label="Incidencias" name="incidencias" register={register} placeholder="Retraso 15/03, Rotura stock harina..." error={errors.incidencias?.message} />
          </div>
          <div className="sm:col-span-2">
            <TextareaField label="Observaciones" name="observaciones" register={register} placeholder="Notas internas sobre el proveedor..." error={errors.observaciones?.message} />
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear proveedor"}
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
