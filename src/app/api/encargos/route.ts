import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const orderSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  clientPhone: z.string().min(1, "El teléfono del cliente es obligatorio"),
  deliveryDate: z.string(),
  comment: z.string().optional(),
})

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  const year = searchParams.get("year")

  const role = session.user.role
  const isAdminOrSocio = role === "ADMIN" || role === "SOCIO"

  const where: Record<string, unknown> = {}

  if (isAdminOrSocio && month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1)
    const endDate = new Date(Number(year), Number(month), 1)
    where.deliveryDate = { gte: startDate, lt: endDate }
  } else if (!isAdminOrSocio) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    where.deliveryDate = { gte: today }
  }

  const orders = await prisma.order.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { deliveryDate: "asc" },
  })

  return NextResponse.json(orders)
})

export const POST = withAuth(async (req, session) => {
  try {
    const body = await req.json()
    const data = orderSchema.parse(body)

    const order = await prisma.order.create({
      data: {
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        deliveryDate: new Date(data.deliveryDate),
        comment: data.comment || null,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al crear el encargo" },
      { status: 500 }
    )
  }
})
