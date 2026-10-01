import { z } from "zod"

export const physicalInventorySchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantityUnit1: z.coerce.number().finite().nonnegative().max(1_000_000_000),
    quantityUnit2: z.coerce.number().finite().nonnegative().max(1_000_000_000),
  }).strict()).min(1).max(10_000).superRefine((lines, context) => {
    if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
      context.addIssue({ code: "custom", message: "No puedes repetir un producto en el conteo" })
    }
  }),
}).strict()

export type PhysicalInventoryInput = z.infer<typeof physicalInventorySchema>
