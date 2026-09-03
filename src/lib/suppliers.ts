import { z } from "zod"

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const supplierInputSchema = z.object({
  legalName: z.string().trim().min(1).max(160),
  taxId: z.string().trim().min(1).max(32),
  billingAddress: optionalText(300),
  contactName: optionalText(120),
  contactPhone: optionalText(40),
  contactEmail: z.string().trim().max(320).refine((value) => !value || z.string().email().safeParse(value).success, "Email no válido").optional(),
  iban: optionalText(42),
  serviceCategory: optionalText(120),
  paymentTerms: optionalText(500),
  deliveryLeadTimeDays: z.coerce.number().int().min(0).optional(),
  minimumOrder: z.coerce.number().finite().min(0).optional(),
  termsNotes: optionalText(1000),
  deliveryFrequency: optionalText(120),
  deliverySchedule: optionalText(120),
  orderingMethod: optionalText(120),
  status: z.string().trim().min(1).max(32),
  reliabilityRating: z.coerce.number().int().min(1).max(5).optional(),
  qualityRating: z.coerce.number().int().min(1).max(5).optional(),
  priceRating: z.coerce.number().int().min(1).max(5).optional(),
  issues: optionalText(2000),
  notes: optionalText(2000),
}).strict()

export const supplierUpdateSchema = supplierInputSchema.partial()

export function sanitizeSupplier<T extends { iban?: unknown }>(supplier: T, includeBankDetails: boolean) {
  if (includeBankDetails) return supplier
  const safe = { ...supplier }
  delete safe.iban
  return { ...safe, iban: null }
}
