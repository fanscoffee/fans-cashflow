import { toN } from "@/lib/money"

export function calculateFondo(
  lastShift: { fondoFinal: unknown } | null,
  additions: { amount: unknown }[]
): number {
  const base = toN(lastShift?.fondoFinal)
  const total = additions.reduce((acc, a) => acc + toN(a.amount), 0)
  return Math.round((base + total) * 100) / 100
}

export function calculateFondoFinal(
  fondoInicial: unknown,
  expenses: { importe: unknown }[],
  currentExpenses: { importe: unknown; estado?: string }[],
): number {
  const legacyTotal = expenses.reduce((acc, expense) => acc + toN(expense.importe), 0)
  const currentTotal = currentExpenses.reduce((acc, expense) => expense.estado === "ANULADO" ? acc : acc + toN(expense.importe), 0)
  return Math.round((toN(fondoInicial) - legacyTotal - currentTotal) * 100) / 100
}
