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
    console.log("No hay ningun turno abierto.")
    return
  }

  const additions = await prisma.fundAddition.findMany({
    where: { createdAt: { gt: openShift.createdAt } },
  })

  if (additions.length === 0) {
    console.log("No se encontraron depositos durante el turno abierto.")
    console.log(`Turno actual: fondoInicial=${toN(openShift.fondoInicial)} fondoFinal=${toN(openShift.fondoFinal)}`)
    return
  }

  const total = additions.reduce<number>((sum, a) => sum + toN(a.amount), 0)

  await prisma.shift.update({
    where: { id: openShift.id },
    data: {
      fondoInicial: { increment: total },
      fondoFinal: { increment: total },
    },
  })

  console.log(`Turno "${openShift.turno}" del ${openShift.date.toISOString().slice(0, 10)} actualizado.`)
  console.log(`Depositos encontrados durante el turno: ${additions.length}`)
  console.log(`Total añadido: +${total.toFixed(2)}`)
  console.log(`Nuevo fondoInicial: ${(toN(openShift.fondoInicial) + total).toFixed(2)}`)
  console.log(`Nuevo fondoFinal: ${(toN(openShift.fondoFinal) + total).toFixed(2)}`)
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
