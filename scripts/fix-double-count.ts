import { prisma } from "../src/lib/prisma"

function toN(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v)
  if (typeof v === "object" && "toString" in v) return parseFloat((v as { toString(): string }).toString())
  return 0
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`ABORTADO: ${msg}`)
  }
}

async function main() {
  const closedWithoutClosedAt = await prisma.shift.findMany({
    where: { status: "CERRADO", closedAt: null },
  })
  console.log(`Turnos cerrados sin closedAt: ${closedWithoutClosedAt.length}`)

  const target = 610

  const turno33 = await prisma.shift.findFirst({
    where: { date: new Date("2026-07-31"), turno: "mañana" },
  })
  const turno34 = await prisma.shift.findFirst({
    where: { date: new Date("2026-07-31"), turno: "tarde" },
  })

  assert(turno33 !== null, "Turno 33 no encontrado (31/07 mañana)")
  assert(turno34 !== null, "Turno 34 no encontrado (31/07 tarde)")

  const t33 = turno33!
  const t34 = turno34!

  assert(toN(t33.fondoInicial) === 1158.2, `Turno 33 fondoInicial esperado 1158.2, actual ${toN(t33.fondoInicial)}`)
  assert(toN(t33.fondoFinal) === 1145.2, `Turno 33 fondoFinal esperado 1145.2, actual ${toN(t33.fondoFinal)}`)
  assert(toN(t34.fondoInicial) === 1145.2, `Turno 34 fondoInicial esperado 1145.2, actual ${toN(t34.fondoInicial)}`)
  assert(toN(t34.fondoFinal) === 1055.2, `Turno 34 fondoFinal esperado 1055.2, actual ${toN(t34.fondoFinal)}`)

  const t33expenses = await prisma.expense.aggregate({
    _sum: { importe: true },
    where: { shiftId: t33.id },
  })
  const t34expenses = await prisma.expense.aggregate({
    _sum: { importe: true },
    where: { shiftId: t34.id },
  })
  assert(toN(t33expenses._sum.importe) === 13, `Turno 33 gastos esperados 13, actual ${toN(t33expenses._sum.importe)}`)
  assert(toN(t34expenses._sum.importe) === 90, `Turno 34 gastos esperados 90, actual ${toN(t34expenses._sum.importe)}`)

  const nuevo33Inicial = toN(t33.fondoInicial) - target
  const nuevo33Final = nuevo33Inicial - toN(t33expenses._sum.importe)
  const nuevo34Inicial = toN(t34.fondoInicial) - target
  const nuevo34Final = nuevo34Inicial - toN(t34expenses._sum.importe)

  console.log(`Corrigiendo turno 33: fondoInicial ${toN(t33.fondoInicial)} -> ${nuevo33Inicial}, fondoFinal ${toN(t33.fondoFinal)} -> ${nuevo33Final}`)
  console.log(`Corrigiendo turno 34: fondoInicial ${toN(t34.fondoInicial)} -> ${nuevo34Inicial}, fondoFinal ${toN(t34.fondoFinal)} -> ${nuevo34Final}`)

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: t33.id },
      data: { fondoInicial: nuevo33Inicial, fondoFinal: nuevo33Final },
    }),
    prisma.shift.update({
      where: { id: t34.id },
      data: { fondoInicial: nuevo34Inicial, fondoFinal: nuevo34Final },
    }),
  ])

  for (const s of closedWithoutClosedAt) {
    await prisma.shift.update({
      where: { id: s.id },
      data: { closedAt: s.updatedAt },
    })
  }
  console.log(`Backfill closedAt = updatedAt para ${closedWithoutClosedAt.length} turnos.`)

  const all = await prisma.shift.findMany({
    include: { expenses: true },
    orderBy: { createdAt: "asc" },
  })
  const last = all[all.length - 1]
  console.log("--- VERIFICACIÓN FINAL ---")
  for (const s of all) {
    const gastos = s.expenses.reduce((acc, e) => acc + toN(e.importe), 0)
    const fondoSegunGastos = toN(s.fondoInicial) - gastos
    const check = toN(s.fondoFinal) === fondoSegunGastos ? "OK" : "MISMATCH"
    console.log(
      `${s.date.toISOString().slice(0, 10)} ${s.turno.padEnd(7)} status=${s.status.padEnd(7)} ` +
      `fondoInicial=${toN(s.fondoInicial).toFixed(2).padStart(9)} fondoFinal=${toN(s.fondoFinal).toFixed(2).padStart(9)} ` +
      `gastos=${gastos.toFixed(2)} [${check}] closedAt=${s.closedAt ? s.closedAt.toISOString() : "null"}`
    )
  }
  console.log(`\nPróximo turno abrirá con fondoInicial = ${toN(last.fondoFinal).toFixed(2)} €`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
