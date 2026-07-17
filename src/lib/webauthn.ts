export const RP_NAME = "Fans Cashflow"
export const RP_ID = process.env.VERCEL_URL || process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "").replace(/:\d+$/, "") || "localhost"

export const ORIGINS = [
  process.env.NEXTAUTH_URL || "http://localhost:3000",
]

type Transport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb"

export function transportsToJSON(transports: Transport[] | undefined): string | null {
  if (!transports) return null
  return JSON.stringify(transports)
}

export function transportsFromJSON(json: string | null): Transport[] | undefined {
  if (!json) return undefined
  return JSON.parse(json) as Transport[]
}
