import { toN } from "@/lib/money"

export function calculateFondo(
  lastShift: { fondoFinal: unknown } | null,
  additions: { amount: unknown }[]
): number {
  const base = toN(lastShift?.fondoFinal)
  const total = additions.reduce((acc, a) => acc + toN(a.amount), 0)
  return Math.round((base + total) * 100) / 100
}
