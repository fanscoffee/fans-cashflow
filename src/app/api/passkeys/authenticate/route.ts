import { NextResponse } from "next/server"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, requestAddress } from "@/lib/rate-limit"
import {
  AUTHENTICATION_CHALLENGE,
  challengeExpiresAt,
  RP_ID,
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
        where: { email },
        select: { id: true, passkeys: { select: { id: true, credentialId: true, transports: true } } },
      })
      if (user) {
        userId = user.id
        passkeys = user.passkeys
      }
    } else {
      const allPasskeys = await prisma.passkey.findMany()
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
        id: isoBase64URL.toBuffer(pk.credentialId),
        type: "public-key" as const,
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
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
