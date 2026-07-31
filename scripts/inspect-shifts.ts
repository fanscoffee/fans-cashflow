import { prisma } from "../src/lib/prisma"

function toN(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v)
  if (typeof v === "object" && "toString" in v) return parseFloat((v as { toString(): string }).toString())
  return 0
}

async function main() {
  const shifts = await prisma.shift.findMany({
    orderBy: { createdAt: "asc" },
    include: { expenses: true },
  })

  const additions = await prisma.fundAddition.findMany({
    orderBy: { createdAt: "asc" },
  })

  console.log("=== FUND ADDITIONS ===")
  for (const a of additions) {
    console.log(
      `[${a.createdAt.toISOString()}] +${toN(a.amount)} (${a.description || "-"}) id=${a.id}`
    )
  }

  console.log("\n=== SHIFTS ===")
  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i]
    const prev = shifts[i - 1] ?? null
    const totalExpenses = s.expenses.reduce((sum, e) => sum + toN(e.importe), 0)
    const expectedFinal = toN(s.fondoInicial) - totalExpenses
    const additionsSincePrev = prev
      ? additions.filter((a) => a.createdAt > prev.createdAt && a.createdAt <= s.createdAt).reduce((sum, a) => sum + toN(a.amount), 0)
      : additions.filter((a) => a.createdAt <= s.createdAt).reduce((sum, a) => sum + toN(a.amount), 0)

    console.log(`---`)
    console.log(`Turno ${i + 1}: ${s.turno} ${s.date.toISOString().slice(0, 10)} status=${s.status}`)
    console.log(`  createdAt=${s.createdAt.toISOString()}`)
    console.log(`  fondoInicial=${toN(s.fondoInicial)} fondoFinal(BD)=${toN(s.fondoFinal)}`)
    console.log(`  gastos=${totalExpenses.toFixed(2)} | fondoInicial - gastos = ${expectedFinal.toFixed(2)}`)
    if (prev) {
      console.log(`  [prev createdAt=${prev.createdAt.toISOString()}]`)
      console.log(`  additions entre prev y este turno: ${additionsSincePrev.toFixed(2)}`)
      console.log(`  prev.fondoFinal + additions = ${(toN(prev.fondoFinal) + additionsSincePrev).toFixed(2)}`)
      console.log(`  ¿coincide con fondoInicial? ${(toN(prev.fondoFinal) + additionsSincePrev).toFixed(2) === toN(s.fondoInicial).toFixed(2) ? "SÍ" : "NO ← AQUÍ HAY DIFERENCIA"}`)
    }
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
