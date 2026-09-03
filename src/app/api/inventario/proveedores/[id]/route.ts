import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { canDeleteInventoryItems } from "@/lib/inventory-permissions"
import { supplierUpdateSchema, sanitizeSupplier } from "@/lib/suppliers"

export const GET = withAuth(async (req, session, context) => {
  const { id } = await context.params
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      products: {
        include: { product: true },
      },
    },
  })

  if (!supplier) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
  }

  const includeBankDetails = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  return NextResponse.json(sanitizeSupplier(supplier, includeBankDetails))
})

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const data = supplierUpdateSchema.parse(await req.json())

    const existing = await prisma.supplier.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })

    if (data.taxId) {
      const conflict = await prisma.supplier.findFirst({
        where: { taxId: data.taxId, id: { not: id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Ya existe otro proveedor con el CIF/NIF ${data.taxId}` },
          { status: 400 }
        )
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al actualizar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!canDeleteInventoryItems(session.user)) {
    return NextResponse.json({ error: "Solo ADMIN o el socio Yomi pueden eliminar proveedores" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true } })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const [products, receipts, invoices, creditors] = await Promise.all([
      prisma.supplierProduct.count({ where: { supplierId: id } }),
      prisma.receipt.count({ where: { supplierId: id } }),
      prisma.invoice.count({ where: { supplierId: id } }),
      prisma.creditor.count({ where: { supplierId: id } }),
    ])
    const links = { products, receipts, invoices, creditors }
    const totalLinks = Object.values(links).reduce((total, count) => total + count, 0)

    if (totalLinks > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar el proveedor porque todavía tiene vinculaciones.",
          code: "PROVIDER_HAS_LINKS",
          links,
          vinculaciones: links,
        },
        { status: 409 }
      )
    }

    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
