import { NextResponse } from "next/server"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, requestAddress } from "@/lib/rate-limit"
import {
  AUTHENTICATION_CHALLENGE,
  ORIGINS,
  RP_ID,
  transportsFromJSON,
} from "@/lib/webauthn"

class WebAuthnStateError extends Error {}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(`passkey-verify:${requestAddress(request)}`, 10, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } })
    }
    const body = await request.json().catch(() => ({}))
    const { credential, challenge } = body

    if (
      !credential ||
      typeof credential !== "object" ||
      typeof credential.id !== "string" ||
      typeof challenge !== "string" ||
      challenge.length < 16 ||
      challenge.length > 512
    ) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    })

    if (!passkey) {
      return NextResponse.json({ error: "Passkey no encontrada" }, { status: 404 })
    }

    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        challenge,
        purpose: AUTHENTICATION_CHALLENGE,
        expiresAt: { gt: new Date() },
        verifiedAt: null,
        consumedAt: null,
        OR: [{ userId: null }, { userId: passkey.userId }],
      },
      select: { id: true },
    })
    if (!challengeRecord) {
      return NextResponse.json({ error: "Challenge no válido o caducado" }, { status: 401 })
    }

    const expectedOrigin = ORIGINS.length === 1 ? ORIGINS[0] : ORIGINS

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(passkey.credentialId),
        credentialPublicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: transportsFromJSON(passkey.transports),
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: "Verificación fallida" }, { status: 401 })
    }

    const currentCounter = Number(passkey.counter)
    const newCounter = verification.authenticationInfo.newCounter
    if (currentCounter > 0 && newCounter <= currentCounter) {
      return NextResponse.json({ error: "Contador del autenticador no válido" }, { status: 401 })
    }

    const stateUpdated = await prisma.$transaction(async (tx) => {
      const challengeUpdated = await tx.webAuthnChallenge.updateMany({
        where: {
          id: challengeRecord.id,
          expiresAt: { gt: new Date() },
          verifiedAt: null,
          consumedAt: null,
        },
        data: { verifiedAt: new Date(), verifiedUserId: passkey.userId },
      })
      if (challengeUpdated.count !== 1) return false

      const counterUpdated = await tx.passkey.updateMany({
        where: { id: passkey.id, counter: passkey.counter },
        data: { counter: BigInt(newCounter) },
      })
      if (counterUpdated.count !== 1) throw new WebAuthnStateError()
      return true
    }).catch((error) => {
      if (error instanceof WebAuthnStateError) return false
      throw error
    })

    if (!stateUpdated) {
      return NextResponse.json({ error: "Autenticación fallida" }, { status: 401 })
    }

    return NextResponse.json({
      verified: true,
      user: {
        id: passkey.user.id,
        email: passkey.user.email,
        name: passkey.user.name,
        role: passkey.user.role,
      },
    })
  } catch (error) {
    if (error instanceof WebAuthnStateError) {
      return NextResponse.json({ error: "Autenticación fallida" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Error al verificar passkey" },
      { status: 500 }
    )
  }
}
