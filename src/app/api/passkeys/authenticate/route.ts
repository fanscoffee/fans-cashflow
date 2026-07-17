import { NextResponse } from "next/server"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { prisma } from "@/lib/prisma"
import { RP_ID } from "@/lib/webauthn"

type PasskeyRow = { id: string; credentialId: string; transports: string | null }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    let passkeys: PasskeyRow[] = []

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { passkeys: true },
      })
      if (user) {
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
      userVerification: "preferred",
    })

    return NextResponse.json(options)
  } catch (error) {
    console.error("Error generando opciones de autenticación:", error)
    return NextResponse.json(
      { error: "Error al generar opciones" },
      { status: 500 }
    )
  }
}
