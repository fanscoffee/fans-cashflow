import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { supplierInputSchema, sanitizeSupplier } from "@/lib/suppliers"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const status = getFirstSearchParam(searchParams, "status", "estado") || ""
  const category = getFirstSearchParam(searchParams, "category", "categoria") || ""
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "50")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 50

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { legalName: { contains: search, mode: "insensitive" } },
      { taxId: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
    ]
  }
  if (status) where.status = status
  if (category) where.serviceCategory = category

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { legalName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { products: true } } },
    }),
    prisma.supplier.count({ where }),
  ])

  const includeBankDetails = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  return NextResponse.json({ suppliers: suppliers.map((supplier) => sanitizeSupplier(supplier, includeBankDetails)), total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const data = supplierInputSchema.parse(await req.json())

    const existing = await prisma.supplier.findUnique({
      where: { taxId: data.taxId },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un proveedor con el CIF/NIF ${data.taxId}` },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al crear el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
