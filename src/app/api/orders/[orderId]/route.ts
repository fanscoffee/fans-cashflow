import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const updateOrderSchema = z.object({
  clientName: z.string().min(1).optional(),
  clientPhone: z.string().min(1).optional(),
  deliveryDate: z.string().optional(),
  comment: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "ADMIN" && role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { orderId } = await params

  try {
    const body = await request.json()
    const data = updateOrderSchema.parse(body)

    const existing = await prisma.order.findUnique({ where: { id: orderId } })
    if (!existing) {
      return NextResponse.json({ error: "Encargo no encontrado" }, { status: 404 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.clientName !== undefined && { clientName: data.clientName }),
        ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone }),
        ...(data.deliveryDate !== undefined && { deliveryDate: new Date(data.deliveryDate) }),
        ...(data.comment !== undefined && { comment: data.comment }),
      },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Error al actualizar el encargo" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const role = session.user.role
  if (role !== "ADMIN" && role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { orderId } = await params

  const existing = await prisma.order.findUnique({ where: { id: orderId } })
  if (!existing) {
    return NextResponse.json({ error: "Encargo no encontrado" }, { status: 404 })
  }

  await prisma.order.delete({ where: { id: orderId } })

  return NextResponse.json({ success: true })
}
