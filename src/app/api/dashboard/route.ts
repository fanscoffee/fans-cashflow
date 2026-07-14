import { NextResponse, NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

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
    (sum, s) => sum + Number(s.efectivo) + Number(s.caixa) + Number(s.santander),
    0
  )
  const totalGastosShift = shifts.reduce((sum, s) => sum + Number(s.efectivoGasto), 0)
  const totalGastosExpense = shifts.reduce(
    (sum, s) => sum + s.expenses.reduce((e, exp) => e + Number(exp.importe), 0),
    0
  )
  const totalGastos = totalGastosShift + totalGastosExpense
  const beneficioNeto = totalIngresos - totalGastos

  const porDia: Record<string, { ingresos: number; gastos: number; mañana: number; tarde: number }> = {}
  for (const s of shifts) {
    const key = new Date(s.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    if (!porDia[key]) porDia[key] = { ingresos: 0, gastos: 0, mañana: 0, tarde: 0 }
    const ingreso = Number(s.efectivo) + Number(s.caixa) + Number(s.santander)
    const gasto = Number(s.efectivoGasto) + s.expenses.reduce((e, exp) => e + Number(exp.importe), 0)
    porDia[key].ingresos += ingreso
    porDia[key].gastos += gasto
    if (s.turno === "mañana") porDia[key].mañana += ingreso
    else porDia[key].tarde += ingreso
  }

  const dailyData = Object.entries(porDia).map(([dia, v]) => ({
    dia,
    ingresos: Math.round(v.ingresos * 100) / 100,
    gastos: Math.round(v.gastos * 100) / 100,
    mañana: Math.round(v.mañana * 100) / 100,
    tarde: Math.round(v.tarde * 100) / 100,
  }))

  const morningTotal = shifts
    .filter((s) => s.turno === "mañana")
    .reduce((sum, s) => sum + Number(s.efectivo) + Number(s.caixa) + Number(s.santander), 0)
  const afternoonTotal = shifts
    .filter((s) => s.turno === "tarde")
    .reduce((sum, s) => sum + Number(s.efectivo) + Number(s.caixa) + Number(s.santander), 0)

  const turnoData = [
    { name: "Mañana", value: Math.round(morningTotal * 100) / 100 },
    { name: "Tarde", value: Math.round(afternoonTotal * 100) / 100 },
  ]

  const gastosPorProveedor: Record<string, number> = {}
  for (const s of shifts) {
    for (const e of s.expenses) {
      gastosPorProveedor[e.proveedor] = (gastosPorProveedor[e.proveedor] ||  0) + Number(e.importe)
    }
  }
  const expenseData = Object.entries(gastosPorProveedor)
    .map(([proveedor, total]) => ({
      proveedor,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)

  const exportData = shifts.map((s) => ({
    fecha: new Date(s.date).toLocaleDateString("es-ES"),
    turno: s.turno,
    estado: s.status,
    creadoPor: s.createdBy?.name || "",
    fondoInicial: Number(s.fondoInicial),
    efectivo: Number(s.efectivo),
    caixa: Number(s.caixa),
    santander: Number(s.santander),
    efectivoGasto: Number(s.efectivoGasto),
    fondoFinal: Number(s.fondoFinal),
    totalGastos: s.expenses.reduce((e, exp) => e + Number(exp.importe), 0),
    gastos: s.expenses.map((e) => `${e.proveedor}: ${Number(e.importe).toFixed(2)}`).join("; "),
  }))

  const exportExpenses = shifts.flatMap((s) =>
    s.expenses.map((e) => ({
      fecha: new Date(s.date).toLocaleDateString("es-ES"),
      turno: s.turno,
      proveedor: e.proveedor,
      importe: Number(e.importe),
      creadoPor: s.createdBy?.name || "",
    }))
  )

  return NextResponse.json({
    resumen: {
      totalTurnos: shifts.length,
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalGastos: Math.round(totalGastos * 100) / 100,
      beneficioNeto: Math.round(beneficioNeto * 100) / 100,
    },
    dailyData,
    turnoData,
    expenseData,
    exportData,
    exportExpenses,
  })
}
