import { z } from "zod"

export const GENERIC_RECEIPT_PRODUCT_LABEL = "PRODUCTO GENÉRICO"
export const GENERIC_RECEIPT_UNIT = "UD"

const optionalDate = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida").optional(),
)

export const receptionLineSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto").nullable(),
  genericDescription: z.string().trim().max(500, "La descripción no puede superar los 500 caracteres").nullable().optional(),
  genericVatPercentage: z.number().min(0, "El IVA no puede ser negativo").max(100, "El IVA no puede superar el 100%").nullable().optional(),
  receivedQuantity: z.coerce.number().finite().positive("La cantidad debe ser mayor a 0").max(1_000_000),
  packageCount: z.coerce.number().int("La cantidad de elementos debe ser un número entero").positive("La cantidad de elementos debe ser mayor a 0").max(1_000_000).default(1),
  unitPrice: z.coerce.number().finite().nonnegative("El precio no puede ser negativo").max(1_000_000_000),
  batch: z.string().trim().max(120).nullable().optional(),
  dueDate: optionalDate,
}).strict().superRefine((line, context) => {
  if (line.productId === null) {
    if (!line.genericDescription) {
      context.addIssue({ code: "custom", path: ["genericDescription"], message: "Describe el producto genérico" })
    }
    if (line.genericVatPercentage == null) {
      context.addIssue({ code: "custom", path: ["genericVatPercentage"], message: "Indica el IVA del producto genérico" })
    }
  } else if (line.genericDescription != null || line.genericVatPercentage != null) {
    context.addIssue({ code: "custom", path: ["productId"], message: "Un producto del catálogo no admite datos de producto genérico" })
  }
})

export const receptionSchema = z.object({
  deliveryNoteCode: z.string().trim().min(1).max(120),
  supplierId: z.string().min(1),
  receivedAt: z.string().min(1).refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  notes: z.string().trim().max(1000).nullable().optional(),
  transportCost: z.coerce.number().finite().nonnegative().max(1_000_000_000).default(0),
  lines: z.array(receptionLineSchema).min(1).max(500),
}).strict()

export type ReceptionInput = z.infer<typeof receptionSchema>
