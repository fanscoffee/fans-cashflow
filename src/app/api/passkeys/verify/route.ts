import { NextResponse } from "next/server"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { prisma } from "@/lib/prisma"
import { RP_ID, ORIGINS, transportsFromJSON } from "@/lib/webauthn"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { credential, challenge } = body

    if (!credential || !challenge) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    })

    if (!passkey) {
      return NextResponse.json({ error: "Passkey no encontrada" }, { status: 404 })
    }

    const expectedOrigin = ORIGINS[0]

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
        transports: transportsFromJSON(passkey.transports),
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: "Verificación fallida" }, { status: 401 })
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    })

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
    console.error("Error en verificación de passkey:", error)
    return NextResponse.json(
      { error: "Error al verificar passkey" },
      { status: 500 }
    )
  }
}
