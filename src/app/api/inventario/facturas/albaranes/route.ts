import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const supplierId = getFirstSearchParam(searchParams, "supplierId", "proveedorId") || ""
  const invoiceId = getFirstSearchParam(searchParams, "invoiceId", "facturaId") || ""
  const search = searchParams.get("search") || ""
  if (!supplierId) return NextResponse.json({ deliveryNotes: [] })

  const deliveryNotes = await prisma.receipt.findMany({
    where: {
      supplierId,
      ...(invoiceId ? { OR: [{ invoiceId: null }, { invoiceId }] } : { invoiceId: null }),
      ...(search ? { deliveryNoteCode: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: 100,
    select: {
      id: true,
      deliveryNoteCode: true,
      receivedAt: true,
      lines: {
        select: {
          productId: true,
          receivedQuantity: true,
          unitPrice: true,
          product: { select: { code: true, posDescription: true, purchaseUnit: true } },
        },
      },
    },
  })

  return NextResponse.json({ deliveryNotes })
})
