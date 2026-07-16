import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const orderSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  clientPhone: z.string().min(1, "El teléfono del cliente es obligatorio"),
  deliveryDate: z.string(),
  comment: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const role = session.user.role
  const isAdminOrSocio = role === "ADMIN" || role === "SOCIO"

  const where = isAdminOrSocio
    ? {}
    : {
        deliveryDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }

  const orders = await prisma.order.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { deliveryDate: "asc" },
  })

  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
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
}
