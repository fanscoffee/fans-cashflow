import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN, sum, toJSON, toFixed } from "@/lib/money"
import { CurrentExpenseStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get("month")
  const yearParam = searchParams.get("year")

  const now = new Date()
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1
  const year = yearParam ? Number(yearParam) : now.getFullYear()
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Periodo no válido" }, { status: 400 })
  }

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      expenses: true,
      currentExpenses: {
        where: { status: { not: CurrentExpenseStatus.VOID } },
        select: { concept: true, amount: true, category: { select: { name: true } } },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  })

  const totalRevenue = shifts.reduce(
    (acc, s) => acc + sum(s.cash, s.caixaBankAmount, s.santanderAmount),
    0
  )
  const totalExpensesShift = shifts.reduce((acc, s) => acc + toN(s.cashExpense), 0)
  const totalExpensesExpense = shifts.reduce(
    (acc, s) => acc + s.expenses.reduce((e, exp) => e + toN(exp.amount), 0),
    0
  )
  const totalExpensesCurrent = shifts.reduce(
    (acc, s) => acc + (s.currentExpenses || []).reduce((e, expense) => e + toN(expense.amount), 0),
    0
  )
  const totalExpenses = totalExpensesShift + totalExpensesExpense + totalExpensesCurrent
  const netProfit = totalRevenue - totalExpenses

  const dailyTotals: Record<string, { revenue: number; expenses: number; morning: number; afternoon: number }> = {}
  for (const s of shifts) {
    const key = new Date(s.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    if (!dailyTotals[key]) dailyTotals[key] = { revenue: 0, expenses: 0, morning: 0, afternoon: 0 }
    const revenue = sum(s.cash, s.caixaBankAmount, s.santanderAmount)
    const expense = toN(s.cashExpense) + s.expenses.reduce((e, exp) => e + toN(exp.amount), 0) + (s.currentExpenses || []).reduce((e, expense) => e + toN(expense.amount), 0)
    dailyTotals[key].revenue += revenue
    dailyTotals[key].expenses += expense
    if (s.shift === "mañana") dailyTotals[key].morning += revenue
    else dailyTotals[key].afternoon += revenue
  }

  const dailyData = Object.entries(dailyTotals).map(([day, totals]) => ({
    day,
    revenue: toJSON(totals.revenue),
    expenses: toJSON(totals.expenses),
    morning: toJSON(totals.morning),
    afternoon: toJSON(totals.afternoon),
    // Legacy response keys are kept for existing dashboard consumers.
    dia: day,
    ingresos: toJSON(totals.revenue),
    gastos: toJSON(totals.expenses),
    mañana: toJSON(totals.morning),
    tarde: toJSON(totals.afternoon),
  }))

  const morningRevenue = shifts
    .filter((s) => s.shift === "mañana")
    .reduce((acc, s) => acc + sum(s.cash, s.caixaBankAmount, s.santanderAmount), 0)
  const afternoonRevenue = shifts
    .filter((s) => s.shift === "tarde")
    .reduce((acc, s) => acc + sum(s.cash, s.caixaBankAmount, s.santanderAmount), 0)

  const shiftData = [
    { name: "Mañana", value: toJSON(morningRevenue) },
    { name: "Tarde", value: toJSON(afternoonRevenue) },
  ]

  const expensesBySupplier: Record<string, number> = {}
  for (const s of shifts) {
    for (const e of s.expenses) {
      expensesBySupplier[e.supplier] = (expensesBySupplier[e.supplier] || 0) + toN(e.amount)
    }
    for (const e of s.currentExpenses || []) {
      const label = `Gasto corriente · ${e.category.name}`
      expensesBySupplier[label] = (expensesBySupplier[label] || 0) + toN(e.amount)
    }
  }
  const expenseData = Object.entries(expensesBySupplier)
    .map(([supplier, total]) => ({
      supplier,
      proveedor: supplier,
      total: toJSON(total),
    }))
    .sort((a, b) => b.total - a.total)

  const exportRows = shifts.map((s) => ({
    date: new Date(s.date).toLocaleDateString("es-ES"),
    shift: s.shift,
    status: s.status,
    createdBy: s.createdBy?.name || "",
    openingFund: toJSON(s.openingFund),
    cash: toJSON(s.cash),
    caixaBankAmount: toJSON(s.caixaBankAmount),
    santanderAmount: toJSON(s.santanderAmount),
    cashExpense: toJSON(s.cashExpense),
    closingFund: toJSON(s.closingFund),
    totalExpenses: s.expenses.reduce((e, exp) => e + toN(exp.amount), 0) + (s.currentExpenses || []).reduce((e, expense) => e + toN(expense.amount), 0),
    expenses: [...s.expenses.map((e) => `${e.supplier}: ${toFixed(e.amount)}`), ...(s.currentExpenses || []).map((e) => `${e.concept}: ${toFixed(e.amount)}`)].join("; "),
  }))

  const exportExpenseRows = shifts.flatMap((s) =>
    [
      ...s.expenses.map((e) => ({
        date: new Date(s.date).toLocaleDateString("es-ES"),
        shift: s.shift,
        concept: "",
        supplier: e.supplier,
        amount: toN(e.amount),
        createdBy: s.createdBy?.name || "",
      })),
      ...(s.currentExpenses || []).map((e) => ({
        date: new Date(s.date).toLocaleDateString("es-ES"),
        shift: s.shift,
        concept: e.concept,
        supplier: `Gasto corriente · ${e.category.name}`,
        amount: toN(e.amount),
        createdBy: s.createdBy?.name || "",
      })),
    ]
  )

  const exportData = exportRows.map((row) => ({
    fecha: row.date,
    turno: row.shift,
    estado: row.status,
    creadoPor: row.createdBy,
    fondoInicial: row.openingFund,
    efectivo: row.cash,
    caixa: row.caixaBankAmount,
    santander: row.santanderAmount,
    efectivoGasto: row.cashExpense,
    fondoFinal: row.closingFund,
    totalGastos: row.totalExpenses,
    gastos: row.expenses,
  }))

  const exportExpenses = exportExpenseRows.map((row) => ({
    fecha: row.date,
    turno: row.shift,
    concepto: row.concept,
    proveedor: row.supplier,
    importe: row.amount,
    creadoPor: row.createdBy,
  }))

  const summary = {
    totalShifts: shifts.length,
    totalRevenue: toJSON(totalRevenue),
    totalExpenses: toJSON(totalExpenses),
    netProfit: toJSON(netProfit),
  }

  return NextResponse.json({
    summary,
    resumen: {
      ...summary,
      totalTurnos: summary.totalShifts,
      totalIngresos: toJSON(totalRevenue),
      totalGastos: toJSON(totalExpenses),
      beneficioNeto: toJSON(netProfit),
    },
    dailyData,
    shiftData,
    turnoData: shiftData,
    expenseData,
    exportData,
    exportExpenses,
  })
})
