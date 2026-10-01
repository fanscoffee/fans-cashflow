import { z } from "zod"

const optionalDate = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida").optional(),
)

export const receptionSchema = z.object({
  deliveryNoteCode: z.string().trim().min(1).max(120),
  supplierId: z.string().min(1),
  receivedAt: z.string().min(1).refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  notes: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    receivedQuantity: z.coerce.number().finite().positive().max(1_000_000),
    unitPrice: z.coerce.number().finite().nonnegative().max(1_000_000_000),
    batch: z.string().trim().max(120).nullable().optional(),
    dueDate: optionalDate,
  }).strict()).min(1).max(500),
}).strict()

export type ReceptionInput = z.infer<typeof receptionSchema>
