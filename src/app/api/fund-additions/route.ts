import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const fundAdditionSchema = z.object({
  amount: z.number().finite().min(0.01, "El monto debe ser mayor a 0").max(1_000_000_000),
  description: z.string().trim().max(500).optional(),
})

export const GET = withAuth(async (_req, session) => {
  if (session.user.role !== "SOCIO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

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

    const addition = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(6432101)`)
      const created = await tx.fundAddition.create({
        data: {
          amount: data.amount,
          description: data.description || null,
          createdById: session.user.id,
        },
        include: { createdBy: { select: { name: true, email: true } } },
      })

      const openShift = await tx.shift.findFirst({
        where: { status: "ABIERTO" },
      })
      if (openShift) {
        await tx.shift.update({
          where: { id: openShift.id },
          data: {
            fondoInicial: { increment: data.amount },
            fondoFinal: { increment: data.amount },
          },
        })
      }
      return created
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
