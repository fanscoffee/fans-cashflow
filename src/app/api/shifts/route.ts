import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const shiftSchema = z.object({
  date: z.string(),
  turno: z.enum(["mañana", "tarde"]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const isAdminOrSocio = session.user.role === "ADMIN" || session.user.role === "SOCIO"

  let shifts

  const orderBy = [{ date: "desc" as const }, { turno: "asc" as const }]

  if (isAdminOrSocio) {
    shifts = await prisma.shift.findMany({
      include: { expenses: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })
  } else {
    const openShift = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "ABIERTO" },
      include: { expenses: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    const lastClosed = await prisma.shift.findFirst({
      where: { createdById: session.user.id, status: "CERRADO" },
      include: { expenses: true, createdBy: { select: { name: true, email: true } } },
      orderBy,
    })

    shifts = [openShift, lastClosed].filter(Boolean)
  }

  return NextResponse.json(shifts)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const openShift = await prisma.shift.findFirst({
    where: { status: "ABIERTO" },
  })
  if (openShift) {
    return NextResponse.json(
      { error: "Ya hay un turno abierto. Espera a que se cierre antes de abrir uno nuevo." },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const data = shiftSchema.parse(body)

    const existingShift = await prisma.shift.findFirst({
      where: {
        date: new Date(data.date),
        turno: data.turno,
      },
    })
    if (existingShift) {
      return NextResponse.json(
        { error: `Ya existe un turno de ${data.turno} para esta fecha.` },
        { status: 400 }
      )
    }

    const lastShift = await prisma.shift.findFirst({
      orderBy: { createdAt: "desc" },
    })

    const sinceDate = lastShift?.createdAt ?? new Date(0)

    const additionsResult = await prisma.fundAddition.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gt: sinceDate } },
    })

    const totalAdditions = Number(additionsResult._sum.amount ?? 0)
    const fondoInicial = (lastShift ? Number(lastShift.fondoFinal) : 0) + totalAdditions

    const shift = await prisma.shift.create({
      data: {
        date: new Date(data.date),
        turno: data.turno,
        status: "ABIERTO",
        createdById: session.user.id,
        efectivo: 0,
        caixa: 0,
        santander: 0,
        efectivoGasto: 0,
        fondoInicial,
        fondoFinal: fondoInicial,
      },
      include: { expenses: true },
    })

    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al crear el turno" },
      { status: 500 }
    )
  }
}
