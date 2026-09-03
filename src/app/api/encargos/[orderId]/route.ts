import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

const updateOrderSchema = z.object({
  clientName: z.string().trim().min(1).max(160).optional(),
  clientPhone: z.string().trim().min(1).max(40).optional(),
  deliveryDate: z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida").optional(),
  comment: z.string().trim().max(1000).optional(),
  isPaid: z.boolean().optional(),
  isDelivered: z.boolean().optional(),
})

const dataFields = ["clientName", "clientPhone", "deliveryDate", "comment"]

export const PATCH = withAuth(async (req, session, context) => {
  const role = session.user.role

  const { orderId } = await context.params

  try {
    const body = await req.json()
    const data = updateOrderSchema.parse(body)

    const hasDataFields = dataFields.some((f) => data[f as keyof typeof data] !== undefined)
    if (hasDataFields && !hasAnyRole(role, [UserRole.ADMIN, UserRole.PARTNER])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

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
        ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
        ...(data.isDelivered !== undefined && { isDelivered: data.isDelivered }),
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
})

export const DELETE = withAuth(async (req, session, context) => {
  const role = session.user.role
  if (!hasAnyRole(role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { orderId } = await context.params

  const existing = await prisma.order.findUnique({ where: { id: orderId } })
  if (!existing) {
    return NextResponse.json({ error: "Encargo no encontrado" }, { status: 404 })
  }

  await prisma.order.delete({ where: { id: orderId } })

  return NextResponse.json({ success: true })
})
