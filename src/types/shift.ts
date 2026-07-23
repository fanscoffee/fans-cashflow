import { z } from "zod"

export interface Expense {
  id: string
  proveedor: string
  importe: number
}

export interface Shift {
  id: string
  date: string
  turno: string
  status: string
  efectivo: number
  caixa: number
  santander: number
  efectivoGasto: number
  fondoInicial: number
  fondoFinal: number
  expenses: Expense[]
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

export const shiftSchema = z.object({
  turno: z.enum(["mañana", "tarde"], { message: "Selecciona un turno" }),
})

export type ShiftFormData = z.infer<typeof shiftSchema>

export const expenseSchema = z.object({
  proveedor: z.string().min(1, "El proveedor es obligatorio"),
  importe: z.number().min(0.01, "El importe debe ser mayor a 0"),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
