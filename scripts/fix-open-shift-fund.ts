import { prisma } from "../src/lib/prisma"

function toN(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v)
  if (typeof v === "object" && "toString" in v) return parseFloat((v as { toString(): string }).toString())
  return 0
}

async function main() {
  const openShift = await prisma.shift.findFirst({
    where: { status: "ABIERTO" },
  })

  if (!openShift) {
    console.log("No open shift found.")
    return
  }

  const additions = await prisma.fundAddition.findMany({
    where: { createdAt: { gt: openShift.createdAt } },
  })

  if (additions.length === 0) {
    console.log("No fund additions found during the open shift.")
    console.log(`Current shift: openingFund=${toN(openShift.openingFund)} closingFund=${toN(openShift.closingFund)}`)
    return
  }

  const total = additions.reduce<number>((sum, a) => sum + toN(a.amount), 0)

  await prisma.shift.update({
    where: { id: openShift.id },
    data: {
      openingFund: { increment: total },
      closingFund: { increment: total },
    },
  })

  console.log(`Shift "${openShift.shift}" on ${openShift.date.toISOString().slice(0, 10)} updated.`)
  console.log(`Fund additions found during the shift: ${additions.length}`)
  console.log(`Total added: +${total.toFixed(2)}`)
  console.log(`New openingFund: ${(toN(openShift.openingFund) + total).toFixed(2)}`)
  console.log(`New closingFund: ${(toN(openShift.closingFund) + total).toFixed(2)}`)
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
