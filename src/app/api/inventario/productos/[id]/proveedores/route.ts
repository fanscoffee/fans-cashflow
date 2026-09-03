import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

const optionalNumber = (schema: z.ZodType<number>) => z.preprocess(
  (value) => value === null || value === "" ? undefined : value,
  schema.optional(),
) as z.ZodType<number | undefined>

const relationFields = {
  supplierReference: z.string().trim().max(120).nullable().optional(),
  purchasePriceExcludingVat: optionalNumber(z.coerce.number().finite().min(0)),
  deliveryLeadTimeDays: optionalNumber(z.coerce.number().int().min(0)),
  minimumOrder: optionalNumber(z.coerce.number().finite().min(0)),
  isPrimary: z.boolean().optional(),
  active: z.boolean().optional(),
}

const createRelationSchema = z.object({
  supplierId: z.string().min(1),
  ...relationFields,
}).strict()

const updateRelationSchema = z.object({
  relationId: z.string().min(1),
  ...relationFields,
}).strict()

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } })
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

  const relations = await prisma.supplierProduct.findMany({
    where: { productId: id },
    include: { supplier: { select: { id: true, legalName: true, taxId: true } } },
    orderBy: { isPrimary: "desc" },
  })

  return NextResponse.json(relations)
})

export const POST = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const input = createRelationSchema.parse(await req.json())
    const [product, supplier] = await Promise.all([
      prisma.product.findUnique({ where: { id }, select: { id: true } }),
      prisma.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, status: true } }),
    ])
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    if (!supplier || supplier.status !== "Activo") return NextResponse.json({ error: "Proveedor no disponible" }, { status: 409 })

    const existing = await prisma.supplierProduct.findUnique({
      where: { supplierId_productId: { supplierId: input.supplierId, productId: id } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Este proveedor ya está asignado a este producto" },
        { status: 400 }
      )
    }

    const relation = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.supplierProduct.updateMany({
          where: { productId: id, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      return tx.supplierProduct.create({
        data: {
          supplierId: input.supplierId,
          productId: id,
          supplierReference: input.supplierReference || null,
          purchasePriceExcludingVat: input.purchasePriceExcludingVat ?? null,
          deliveryLeadTimeDays: input.deliveryLeadTimeDays ?? null,
          minimumOrder: input.minimumOrder ?? null,
          isPrimary: input.isPrimary || false,
          active: input.active ?? true,
        },
        include: { supplier: { select: { id: true, legalName: true, taxId: true } } },
      })
    })

    return NextResponse.json(relation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al asignar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const input = updateRelationSchema.parse(await req.json())
    const { relationId, ...data } = input
    const existing = await prisma.supplierProduct.findFirst({ where: { id: relationId, productId: id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Relación no encontrada" }, { status: 404 })

    if (data.isPrimary) {
      await prisma.supplierProduct.updateMany({
        where: { productId: id, isPrimary: true, id: { not: relationId } },
        data: { isPrimary: false },
      })
    }

    const relation = await prisma.supplierProduct.update({
      where: { id: relationId },
      data: {
        ...(data.supplierReference !== undefined && { supplierReference: data.supplierReference || null }),
        ...(data.purchasePriceExcludingVat !== undefined && { purchasePriceExcludingVat: data.purchasePriceExcludingVat ?? null }),
        ...(data.deliveryLeadTimeDays !== undefined && { deliveryLeadTimeDays: data.deliveryLeadTimeDays ?? null }),
        ...(data.minimumOrder !== undefined && { minimumOrder: data.minimumOrder ?? null }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: { supplier: { select: { id: true, legalName: true, taxId: true } } },
    })

    return NextResponse.json(relation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al actualizar la relación"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

    const { id } = await context.params

  try {
    const { searchParams } = new URL(req.url)
    const relationId = searchParams.get("relationId")

    let relationToDelete = relationId
    if (!relationToDelete) {
      const body = await req.json()
      relationToDelete = z.object({ supplierId: z.string().min(1) }).parse(body).supplierId
      const relation = await prisma.supplierProduct.findUnique({
        where: { supplierId_productId: { supplierId: relationToDelete, productId: id } },
        select: { id: true },
      })
      relationToDelete = relation?.id || null
    } else {
      const relation = await prisma.supplierProduct.findFirst({ where: { id: relationToDelete, productId: id }, select: { id: true } })
      relationToDelete = relation?.id || null
    }
    if (!relationToDelete) return NextResponse.json({ error: "Relación no encontrada" }, { status: 404 })
    await prisma.supplierProduct.delete({ where: { id: relationToDelete } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al desasignar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
