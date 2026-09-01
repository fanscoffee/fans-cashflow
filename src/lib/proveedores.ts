import { z } from "zod"

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const proveedorInputSchema = z.object({
  razonSocial: z.string().trim().min(1).max(160),
  cifNif: z.string().trim().min(1).max(32),
  direccionFiscal: optionalText(300),
  contactoNombre: optionalText(120),
  contactoTelefono: optionalText(40),
  contactoEmail: z.string().trim().max(320).refine((value) => !value || z.string().email().safeParse(value).success, "Email no válido").optional(),
  iban: optionalText(42),
  categoriaServicio: optionalText(120),
  condicionesPago: optionalText(500),
  plazoEntregaDias: z.coerce.number().int().min(0).optional(),
  pedidoMinimo: z.coerce.number().finite().min(0).optional(),
  notasCondiciones: optionalText(1000),
  frecuenciaEntrega: optionalText(120),
  horarioEntrega: optionalText(120),
  metodoPedido: optionalText(120),
  estado: z.string().trim().min(1).max(32),
  valoracionFiabilidad: z.coerce.number().int().min(1).max(5).optional(),
  valoracionCalidad: z.coerce.number().int().min(1).max(5).optional(),
  valoracionPrecio: z.coerce.number().int().min(1).max(5).optional(),
  incidencias: optionalText(2000),
  observaciones: optionalText(2000),
}).strict()

export const proveedorUpdateSchema = proveedorInputSchema.partial()

export function sanitizeProveedor<T extends { iban?: unknown }>(proveedor: T, includeBankDetails: boolean) {
  if (includeBankDetails) return proveedor
  const safe = { ...proveedor }
  delete safe.iban
  return { ...safe, iban: null }
}
