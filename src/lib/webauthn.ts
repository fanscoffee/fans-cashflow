export const RP_NAME = "Fans Cashflow"
const configuredOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000"
const parsedOrigin = (() => {
  try {
    return new URL(configuredOrigin)
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_URL debe ser una URL válida para WebAuthn")
    }
    return new URL("http://localhost:3000")
  }
})()

export const RP_ID = parsedOrigin.hostname
export const ORIGINS = [parsedOrigin.origin]

export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000

export const AUTHENTICATION_CHALLENGE = "AUTHENTICATION"
export const REGISTRATION_CHALLENGE = "REGISTRATION"

export function challengeExpiresAt(now = Date.now()) {
  return new Date(now + WEBAUTHN_CHALLENGE_TTL_MS)
}

type Transport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb"

export function transportsToJSON(transports: Transport[] | undefined): string | null {
  if (!transports) return null
  return JSON.stringify(transports)
}

export function transportsFromJSON(json: string | null): Transport[] | undefined {
  if (!json) return undefined
  return JSON.parse(json) as Transport[]
}
