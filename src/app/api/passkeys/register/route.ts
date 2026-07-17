import { NextResponse } from "next/server"
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { RP_ID, RP_NAME, ORIGINS } from "@/lib/webauthn"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

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
        userVerification: "preferred",
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
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { credential, challenge } = body

    if (!credential || !challenge) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    const expectedOrigin = ORIGINS[0]

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

    await prisma.passkey.create({
      data: {
        credentialId: isoBase64URL.fromBuffer(regInfo.credentialID),
        userId: session.user.id,
        publicKey: new Uint8Array(regInfo.credentialPublicKey),
        counter: BigInt(regInfo.counter),
        transports: null,
      },
    })

    return NextResponse.json({ verified: true })
  } catch (error) {
    console.error("Error en registro de passkey:", error)
    return NextResponse.json(
      { error: "Error al registrar passkey" },
      { status: 500 }
    )
  }
}
