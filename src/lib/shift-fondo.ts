import { prisma } from "@/lib/prisma"
import { calculateFondoFinal } from "@/lib/fondo"

export async function recalculateShiftFondoFinal(shiftId: string) {
  const [shift, expensesAgg, currentExpensesAgg] = await Promise.all([
    prisma.shift.findUnique({ where: { id: shiftId }, select: { fondoInicial: true } }),
    prisma.expense.aggregate({ _sum: { importe: true }, where: { shiftId } }),
    prisma.gastoCorriente.aggregate({ _sum: { importe: true }, where: { shiftId, estado: { not: "ANULADO" } } }),
  ])
  if (!shift) return null

  const fondoFinal = calculateFondoFinal(
    shift.fondoInicial,
    [{ importe: expensesAgg._sum.importe }],
    [{ importe: currentExpensesAgg._sum.importe }],
  )
  return prisma.shift.update({ where: { id: shiftId }, data: { fondoFinal } })
}
