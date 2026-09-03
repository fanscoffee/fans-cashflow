import { z } from "zod"
import type { DatabasePaymentEntity } from "@/lib/database-enums"

export interface Expense {
  id: string
  supplier: string
  amount: number
}

export interface CurrentExpense {
  id: string
  entity: DatabasePaymentEntity
  concept: string
  accrualDate: string
  amount: number | string
  receipt: string
  status: string
  category: { code: string; name: string }
  requester: { name: string | null; email: string }
}

export interface ShiftClose {
  id: string
  shiftId: string
  cashCloseNumber: string
  pos: string
  openingDateTime: string
  closingDateTime: string
  previousCashFund: number | string
  cashReceipts: number | string
  cashRefunds: number | string
  depositedAmount: number | string
  paymentOutflows: number | string
  theoreticalCash: number | string
  actualCash: number | string
  cashVariance: number | string
  grossSales: number | string
  refunds: number | string
  discounts: number | string
  netSales: number | string
  cashSales: number | string
  cardSales: number | string
  breadVat4Base: number | string
  breadVat4Amount: number | string
  vat10Base: number | string
  vat10Amount: number | string
  varianceNote: string | null
  confirmedAt: string
}

export interface Shift {
  id: string
  date: string
  shift: string
  status: string
  cash: number
  caixaBankAmount: number
  santanderAmount: number
  cashExpense: number
  openingFund: number
  closingFund: number
  expenses: Expense[]
  currentExpenses?: CurrentExpense[]
  shiftClose?: ShiftClose | null
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

export const shiftSchema = z.object({
  shift: z.enum(["mañana", "tarde"], { message: "Selecciona un turno" }),
})

export type ShiftFormData = z.infer<typeof shiftSchema>

export const expenseSchema = z.object({
  supplier: z.string().min(1, "El proveedor es obligatorio"),
  amount: z.number().min(0.01, "El importe debe ser mayor a 0"),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
