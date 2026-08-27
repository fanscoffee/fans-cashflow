import { z } from "zod"

export interface Expense {
  id: string
  proveedor: string
  importe: number
}

export interface CierreTurno {
  id: string
  shiftId: string
  numeroCierreCaja: string
  tpv: string
  fechaHoraApertura: string
  fechaHoraCierre: string
  fondoCajaAnterior: number | string
  cobrosEfectivo: number | string
  reembolsosEfectivo: number | string
  depositado: number | string
  pagosSalidas: number | string
  efectivoTeoricoCaja: number | string
  cantidadEfectivoReal: number | string
  descuadre: number | string
  ventasBrutas: number | string
  reembolsos: number | string
  descuentos: number | string
  ventasNetas: number | string
  ventasEfectivo: number | string
  ventasTarjeta: number | string
  ivaPan4Base: number | string
  ivaPan4Cuota: number | string
  iva10Base: number | string
  iva10Cuota: number | string
  observacionDescuadre: string | null
  confirmadoAt: string
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
  cierreTurno?: CierreTurno | null
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
