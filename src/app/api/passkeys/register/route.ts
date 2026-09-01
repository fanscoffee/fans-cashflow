import { NextResponse } from "next/server"
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  challengeExpiresAt,
  ORIGINS,
  REGISTRATION_CHALLENGE,
  RP_ID,
  RP_NAME,
} from "@/lib/webauthn"

export const GET = withAuth(async (req, session) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { passkeys: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((pk) => ({
        id: isoBase64URL.toBuffer(pk.credentialId),
        type: "public-key" as const,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    })

    await prisma.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    })
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        purpose: REGISTRATION_CHALLENGE,
        userId: session.user.id,
        expiresAt: challengeExpiresAt(),
      },
    })

    return NextResponse.json(options)
  } catch (error) {
    console.error("Error generando opciones de registro:", error)
    return NextResponse.json(
      { error: "Error al generar opciones" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    const body = await req.json().catch(() => ({}))
    const { credential, challenge } = body

    if (
      !credential ||
      typeof credential !== "object" ||
      typeof challenge !== "string" ||
      challenge.length < 16 ||
      challenge.length > 512
    ) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        challenge,
        purpose: REGISTRATION_CHALLENGE,
        userId: session.user.id,
        expiresAt: { gt: new Date() },
        consumedAt: null,
        verifiedAt: null,
      },
      select: { id: true },
    })
    if (!challengeRecord) {
      return NextResponse.json({ error: "Challenge no válido o caducado" }, { status: 401 })
    }

    const expectedOrigin = ORIGINS.length === 1 ? ORIGINS[0] : ORIGINS

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verificación fallida" }, { status: 400 })
    }

    const regInfo = verification.registrationInfo

    await prisma.$transaction(async (tx) => {
      const challengeUpdated = await tx.webAuthnChallenge.updateMany({
        where: {
          id: challengeRecord.id,
          userId: session.user.id,
          expiresAt: { gt: new Date() },
          consumedAt: null,
          verifiedAt: null,
        },
        data: { consumedAt: new Date() },
      })
      if (challengeUpdated.count !== 1) throw new Error("Challenge ya utilizado")

      await tx.passkey.create({
        data: {
          credentialId: isoBase64URL.fromBuffer(regInfo.credentialID),
          userId: session.user.id,
          publicKey: new Uint8Array(regInfo.credentialPublicKey),
          counter: BigInt(regInfo.counter),
          transports: null,
        },
      })
    })

    return NextResponse.json({ verified: true })
  } catch (error) {
    console.error("Error en registro de passkey:", error)
    return NextResponse.json(
      { error: "Error al registrar passkey" },
      { status: 500 }
    )
  }
})
