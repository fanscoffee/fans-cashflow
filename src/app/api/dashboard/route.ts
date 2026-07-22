import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN, sum, sub, toJSON, toFixed } from "@/lib/money"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get("month")
  const yearParam = searchParams.get("year")

  const now = new Date()
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1
  const year = yearParam ? parseInt(yearParam) : now.getFullYear()

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: { expenses: true, createdBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  })

  const totalIngresos = shifts.reduce(
    (acc, s) => acc + sum(s.efectivo, s.caixa, s.santander),
    0
  )
  const totalGastosShift = shifts.reduce((acc, s) => acc + toN(s.efectivoGasto), 0)
  const totalGastosExpense = shifts.reduce(
    (acc, s) => acc + s.expenses.reduce((e, exp) => e + toN(exp.importe), 0),
    0
  )
  const totalGastos = totalGastosShift + totalGastosExpense
  const beneficioNeto = totalIngresos - totalGastos

  const porDia: Record<string, { ingresos: number; gastos: number; mañana: number; tarde: number }> = {}
  for (const s of shifts) {
    const key = new Date(s.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    if (!porDia[key]) porDia[key] = { ingresos: 0, gastos: 0, mañana: 0, tarde: 0 }
    const ingreso = sum(s.efectivo, s.caixa, s.santander)
    const gasto = toN(s.efectivoGasto) + s.expenses.reduce((e, exp) => e + toN(exp.importe), 0)
    porDia[key].ingresos += ingreso
    porDia[key].gastos += gasto
    if (s.turno === "mañana") porDia[key].mañana += ingreso
    else porDia[key].tarde += ingreso
  }

  const dailyData = Object.entries(porDia).map(([dia, v]) => ({
    dia,
    ingresos: toJSON(v.ingresos),
    gastos: toJSON(v.gastos),
    mañana: toJSON(v.mañana),
    tarde: toJSON(v.tarde),
  }))

  const morningTotal = shifts
    .filter((s) => s.turno === "mañana")
    .reduce((acc, s) => acc + sum(s.efectivo, s.caixa, s.santander), 0)
  const afternoonTotal = shifts
    .filter((s) => s.turno === "tarde")
    .reduce((acc, s) => acc + sum(s.efectivo, s.caixa, s.santander), 0)

  const turnoData = [
    { name: "Mañana", value: toJSON(morningTotal) },
    { name: "Tarde", value: toJSON(afternoonTotal) },
  ]

  const gastosPorProveedor: Record<string, number> = {}
  for (const s of shifts) {
    for (const e of s.expenses) {
      gastosPorProveedor[e.proveedor] = (gastosPorProveedor[e.proveedor] || 0) + toN(e.importe)
    }
  }
  const expenseData = Object.entries(gastosPorProveedor)
    .map(([proveedor, total]) => ({
      proveedor,
      total: toJSON(total),
    }))
    .sort((a, b) => b.total - a.total)

  const exportData = shifts.map((s) => ({
    fecha: new Date(s.date).toLocaleDateString("es-ES"),
    turno: s.turno,
    estado: s.status,
    creadoPor: s.createdBy?.name || "",
    fondoInicial: toJSON(s.fondoInicial),
    efectivo: toJSON(s.efectivo),
    caixa: toJSON(s.caixa),
    santander: toJSON(s.santander),
    efectivoGasto: toJSON(s.efectivoGasto),
    fondoFinal: toJSON(s.fondoFinal),
    totalGastos: s.expenses.reduce((e, exp) => e + toN(exp.importe), 0),
    gastos: s.expenses.map((e) => `${e.proveedor}: ${toFixed(e.importe)}`).join("; "),
  }))

  const exportExpenses = shifts.flatMap((s) =>
    s.expenses.map((e) => ({
      fecha: new Date(s.date).toLocaleDateString("es-ES"),
      turno: s.turno,
      proveedor: e.proveedor,
      importe: toN(e.importe),
      creadoPor: s.createdBy?.name || "",
    }))
  )

  return NextResponse.json({
    resumen: {
      totalTurnos: shifts.length,
      totalIngresos: toJSON(totalIngresos),
      totalGastos: toJSON(totalGastos),
      beneficioNeto: toJSON(beneficioNeto),
    },
    dailyData,
    turnoData,
    expenseData,
    exportData,
    exportExpenses,
  })
})
