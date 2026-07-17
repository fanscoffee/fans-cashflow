import { NextResponse } from "next/server"
import { verifyRegistrationResponse } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { RP_ID, ORIGINS } from "@/lib/webauthn"

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
