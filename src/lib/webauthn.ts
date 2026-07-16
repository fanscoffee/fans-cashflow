import { type AuthenticatorTransport } from "@simplewebauthn/server"

export const RP_NAME = "Fans Cashflow"
export const RP_ID = process.env.VERCEL_URL || process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "").replace(/:\d+$/, "") || "localhost"

export const ORIGINS = [
  process.env.NEXTAUTH_URL || "http://localhost:3000",
]

export function transportsToJSON(transports: AuthenticatorTransport[] | undefined): string | null {
  if (!transports) return null
  return JSON.stringify(transports)
}

export function transportsFromJSON(json: string | null): AuthenticatorTransport[] | undefined {
  if (!json) return undefined
  return JSON.parse(json) as AuthenticatorTransport[]
}
