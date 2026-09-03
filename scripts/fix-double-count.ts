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
    throw new Error(`ABORTED: ${msg}`)
  }
}

async function main() {
  const closedWithoutClosedAt = await prisma.shift.findMany({
    where: { status: "CERRADO", closedAt: null },
  })
  console.log(`Closed shifts without closedAt: ${closedWithoutClosedAt.length}`)

  const target = 610

  const shift33 = await prisma.shift.findFirst({
    where: { date: new Date("2026-07-31"), shift: "mañana" },
  })
  const shift34 = await prisma.shift.findFirst({
    where: { date: new Date("2026-07-31"), shift: "tarde" },
  })

  assert(shift33 !== null, "Shift 33 not found (31/07 mañana)")
  assert(shift34 !== null, "Shift 34 not found (31/07 tarde)")

  const t33 = shift33!
  const t34 = shift34!

  assert(toN(t33.openingFund) === 1158.2, `Shift 33 openingFund expected 1158.2, actual ${toN(t33.openingFund)}`)
  assert(toN(t33.closingFund) === 1145.2, `Shift 33 closingFund expected 1145.2, actual ${toN(t33.closingFund)}`)
  assert(toN(t34.openingFund) === 1145.2, `Shift 34 openingFund expected 1145.2, actual ${toN(t34.openingFund)}`)
  assert(toN(t34.closingFund) === 1055.2, `Shift 34 closingFund expected 1055.2, actual ${toN(t34.closingFund)}`)

  const t33expenses = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: { shiftId: t33.id },
  })
  const t34expenses = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: { shiftId: t34.id },
  })
  assert(toN(t33expenses._sum.amount) === 13, `Shift 33 expenses expected 13, actual ${toN(t33expenses._sum.amount)}`)
  assert(toN(t34expenses._sum.amount) === 90, `Shift 34 expenses expected 90, actual ${toN(t34expenses._sum.amount)}`)

  const new33OpeningFund = toN(t33.openingFund) - target
  const new33ClosingFund = new33OpeningFund - toN(t33expenses._sum.amount)
  const new34OpeningFund = toN(t34.openingFund) - target
  const new34ClosingFund = new34OpeningFund - toN(t34expenses._sum.amount)

  console.log(`Updating shift 33: openingFund ${toN(t33.openingFund)} -> ${new33OpeningFund}, closingFund ${toN(t33.closingFund)} -> ${new33ClosingFund}`)
  console.log(`Updating shift 34: openingFund ${toN(t34.openingFund)} -> ${new34OpeningFund}, closingFund ${toN(t34.closingFund)} -> ${new34ClosingFund}`)

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: t33.id },
      data: { openingFund: new33OpeningFund, closingFund: new33ClosingFund },
    }),
    prisma.shift.update({
      where: { id: t34.id },
      data: { openingFund: new34OpeningFund, closingFund: new34ClosingFund },
    }),
  ])

  for (const s of closedWithoutClosedAt) {
    await prisma.shift.update({
      where: { id: s.id },
      data: { closedAt: s.updatedAt },
    })
  }
  console.log(`Backfilled closedAt = updatedAt for ${closedWithoutClosedAt.length} shifts.`)

  const all = await prisma.shift.findMany({
    include: { expenses: true },
    orderBy: { createdAt: "asc" },
  })
  const last = all[all.length - 1]
  console.log("--- FINAL VERIFICATION ---")
  for (const s of all) {
    const expenses = s.expenses.reduce((acc, e) => acc + toN(e.amount), 0)
    const fundAccordingToExpenses = toN(s.openingFund) - expenses
    const check = toN(s.closingFund) === fundAccordingToExpenses ? "OK" : "MISMATCH"
    console.log(
      `${s.date.toISOString().slice(0, 10)} ${s.shift.padEnd(7)} status=${s.status.padEnd(7)} ` +
      `openingFund=${toN(s.openingFund).toFixed(2).padStart(9)} closingFund=${toN(s.closingFund).toFixed(2).padStart(9)} ` +
      `expenses=${expenses.toFixed(2)} [${check}] closedAt=${s.closedAt ? s.closedAt.toISOString() : "null"}`
    )
  }
  console.log(`\nNext shift will open with openingFund = ${toN(last.closingFund).toFixed(2)} EUR`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
