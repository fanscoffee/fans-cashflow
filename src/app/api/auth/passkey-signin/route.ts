import { NextResponse } from "next/server"
import { z } from "zod"
import { signIn } from "@/lib/auth"
import { checkRateLimit, requestAddress } from "@/lib/rate-limit"

const passkeySigninSchema = z.object({
  challenge: z.string().min(16).max(512),
})

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(`passkey-signin:${requestAddress(request)}`, 10, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } })
    }
    const input = passkeySigninSchema.parse(await request.json())

    const result = await signIn("passkey-credentials", {
      challenge: input.challenge,
      redirect: false,
    })

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Challenge no válido" }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    )
  }
}
