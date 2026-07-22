import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const fundAdditionSchema = z.object({
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  description: z.string().optional(),
})

export const GET = withAuth(async () => {
  const additions = await prisma.fundAddition.findMany({
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(additions)
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "SOCIO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = fundAdditionSchema.parse(body)

    const addition = await prisma.fundAddition.create({
      data: {
        amount: data.amount,
        description: data.description || null,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    return NextResponse.json(addition, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al registrar el depósito" },
      { status: 500 }
    )
  }
})
