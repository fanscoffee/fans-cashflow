import { prisma } from "@/lib/prisma"
import { calculateFundFinal } from "@/lib/fund"
import { CurrentExpenseStatus } from "@/lib/database-enums"

export async function recalculateShiftFundFinal(shiftId: string) {
  const [shift, expensesAgg, currentExpensesAgg] = await Promise.all([
    prisma.shift.findUnique({ where: { id: shiftId }, select: { openingFund: true } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { shiftId } }),
    prisma.currentExpense.aggregate({ _sum: { amount: true }, where: { shiftId, status: { not: CurrentExpenseStatus.VOID } } }),
  ])
  if (!shift) return null

  const closingFund = calculateFundFinal(
    shift.openingFund,
    [{ amount: expensesAgg._sum?.amount }],
    [{ amount: currentExpensesAgg._sum?.amount }],
  )
  return prisma.shift.update({ where: { id: shiftId }, data: { closingFund } })
}
