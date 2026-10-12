import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { isOrderDeliveryLocation } from "@/types/order"
import { scheduleCouponForOrder } from "@/lib/coupon-automation"

const updateOrderSchema = z.object({
  clientName: z.string().trim().min(1).max(160).optional(),
  clientPhone: z.string().trim().min(1).max(40).optional(),
  deliveryDate: z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida").optional(),
  deliveryLocation: z.string().trim().refine(isOrderDeliveryLocation, "Local de entrega no válido").optional(),
  comment: z.string().trim().max(1000).optional(),
  isPaid: z.boolean().optional(),
  isDelivered: z.boolean().optional(),
})

const dataFields = ["clientName", "clientPhone", "deliveryDate", "deliveryLocation", "comment"]

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

    const shouldScheduleCoupon = data.isDelivered === true && existing.isDelivered === false
    const transitionDate = new Date()
    const updateData = {
      ...(data.clientName !== undefined && { clientName: data.clientName }),
      ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone }),
      ...(data.deliveryDate !== undefined && { deliveryDate: new Date(data.deliveryDate) }),
      ...(data.deliveryLocation !== undefined && { deliveryLocation: data.deliveryLocation }),
      ...(data.comment !== undefined && { comment: data.comment }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.isDelivered !== undefined && {
        isDelivered: data.isDelivered,
        deliveredAt: data.isDelivered ? existing.deliveredAt || transitionDate : null,
      }),
    }
    const orderInclude = {
      createdBy: { select: { name: true, email: true } },
      coupon: {
        select: {
          code: true,
          discountPercentage: true,
          scheduledFor: true,
          sendStatus: true,
          sentAt: true,
          expiresAt: true,
          usedAt: true,
        },
      },
    } as const

    const order = shouldScheduleCoupon
      ? await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: updateData,
          include: orderInclude,
        })

        await scheduleCouponForOrder(tx, {
          orderId,
          clientName: updatedOrder.clientName,
          deliveredAt: transitionDate,
        })

        return (await tx.order.findUnique({
          where: { id: orderId },
          include: orderInclude,
        })) || updatedOrder
      })
      : await prisma.order.update({
        where: { id: orderId },
        data: updateData,
        include: orderInclude,
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
