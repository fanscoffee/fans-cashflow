type DecimalLike = { toString(): string } | number | string | null | undefined

export function toN(v: DecimalLike | unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "string") return parseFloat(v)
  if (typeof v === "object" && "toString" in v) return parseFloat((v as { toString(): string }).toString())
  return 0
}

export function sum(...values: (DecimalLike | unknown)[]): number {
  return values.reduce<number>((acc, v) => acc + toN(v), 0)
}

export function sub(a: DecimalLike | unknown, b: DecimalLike | unknown): number {
  return toN(a) - toN(b)
}

export function toJSON(v: DecimalLike | unknown): number {
  return Math.round(toN(v) * 100) / 100
}

export function toFixed(v: DecimalLike | unknown, decimals = 2): string {
  return toN(v).toFixed(decimals)
}
