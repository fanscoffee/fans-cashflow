import { toN } from "@/lib/money"
import { CurrentExpenseStatus, parseCurrentExpenseStatus } from "@/lib/database-enums"

export function calculateFund(
  lastShift: { closingFund: unknown } | null,
  additions: { amount: unknown }[]
): number {
  const base = toN(lastShift?.closingFund)
  const total = additions.reduce((acc, a) => acc + toN(a.amount), 0)
  return Math.round((base + total) * 100) / 100
}

export function calculateFundFinal(
  openingFund: unknown,
  expenses: { amount: unknown }[],
  currentExpenses: { amount: unknown; status?: string }[],
): number {
  return Math.round((toN(openingFund) - calculateTotalExpenses(expenses, currentExpenses)) * 100) / 100
}

export function calculateTotalExpenses(
  expenses: { amount: unknown }[],
  currentExpenses: { amount: unknown; status?: string }[],
) {
  const legacyTotal = expenses.reduce((acc, expense) => acc + toN(expense.amount), 0)
  const currentTotal = currentExpenses.reduce((acc, expense) => parseCurrentExpenseStatus(expense.status) === CurrentExpenseStatus.VOID ? acc : acc + toN(expense.amount), 0)
  return legacyTotal + currentTotal
}
