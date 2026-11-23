import { NextResponse } from "next/server"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, requestAddress } from "@/lib/rate-limit"
import { FIRST_ACTIVE_AUTH_VERSION } from "@/lib/user-access"
import {
  AUTHENTICATION_CHALLENGE,
  challengeExpiresAt,
  RP_ID,
  transportsFromJSON,
} from "@/lib/webauthn"

type PasskeyRow = { id: string; credentialId: string; transports: string | null }

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(`passkey-options:${requestAddress(request)}`, 10, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } })
    }
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === "string" ? body.email.trim() : ""

    let passkeys: PasskeyRow[] = []
    let userId: string | null = null

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email, authVersion: { gte: FIRST_ACTIVE_AUTH_VERSION } },
        select: { id: true, passkeys: { select: { id: true, credentialId: true, transports: true } } },
      })
      if (user) {
        userId = user.id
        passkeys = user.passkeys
      }
    } else {
      const allPasskeys = await prisma.passkey.findMany({
        where: { user: { authVersion: { gte: FIRST_ACTIVE_AUTH_VERSION } } },
        select: { id: true, credentialId: true, transports: true },
      })
      passkeys = allPasskeys
    }

    if (passkeys.length === 0) {
      return NextResponse.json(
        { error: "No hay passkeys registradas para este usuario" },
        { status: 404 }
      )
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: transportsFromJSON(pk.transports),
      })),
      userVerification: "required",
    })

    await prisma.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    })
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        purpose: AUTHENTICATION_CHALLENGE,
        userId,
        expiresAt: challengeExpiresAt(),
      },
    })

    return NextResponse.json(options)
  } catch (error) {
    console.error("Error generating authentication options:", error)
    return NextResponse.json(
      { error: "Error al generar opciones" },
      { status: 500 }
    )
  }
}
