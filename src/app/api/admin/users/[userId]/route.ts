import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const updatePasswordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { userId } = await context.params

  try {
    const body = await req.json()
    const data = updatePasswordSchema.parse(body)

    const hashedPassword = await bcrypt.hash(data.password, 10)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al actualizar la contraseña" },
      { status: 500 }
    )
  }
})
