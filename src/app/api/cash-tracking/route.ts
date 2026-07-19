import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const cashTrackingSchema = z.object({
  shiftId: z.string(),
  destination: z.enum(["DEPOSITO", "INGRESO_EN_FONDO", "GUARDADO", "FANS"]),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "ADMIN" && role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      cashTracking: { include: { createdBy: { select: { name: true, email: true } } } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(shifts)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "ADMIN" && role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = cashTrackingSchema.parse(body)

    const existing = await prisma.cashTracking.findUnique({
      where: { shiftId: data.shiftId },
    })

    let result
    if (existing) {
      result = await prisma.cashTracking.update({
        where: { shiftId: data.shiftId },
        data: { destination: data.destination },
      })
    } else {
      result = await prisma.cashTracking.create({
        data: {
          shiftId: data.shiftId,
          destination: data.destination,
          createdById: session.user.id,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al guardar el tracking" },
      { status: 500 }
    )
  }
}
