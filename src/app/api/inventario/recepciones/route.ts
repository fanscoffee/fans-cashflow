import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { canRegisterInventoryReception } from "@/lib/inventory-permissions"
import { getFirstSearchParam } from "@/lib/request-params"

const optionalDate = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida").optional(),
)

const receptionSchema = z.object({
  deliveryNoteCode: z.string().trim().min(1).max(120),
  supplierId: z.string().min(1),
  receivedAt: z.string().min(1).refine((value) => Number.isFinite(new Date(value).getTime()), "Fecha no válida"),
  notes: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    receivedQuantity: z.coerce.number().finite().positive().max(1_000_000),
    unitPrice: z.coerce.number().finite().nonnegative().max(1_000_000_000),
    batch: z.string().trim().max(120).nullable().optional(),
    dueDate: optionalDate,
  }).strict()).min(1).max(500),
}).strict()

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const supplierId = getFirstSearchParam(searchParams, "supplierId", "proveedorId") || ""
  const startDate = getFirstSearchParam(searchParams, "startDate", "fechaDesde") || ""
  const endDate = getFirstSearchParam(searchParams, "endDate", "fechaHasta") || ""
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "20")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 20

  const where: Record<string, unknown> = {}

  if (search) {
    where.deliveryNoteCode = { contains: search, mode: "insensitive" }
  }
  if (supplierId) {
    where.supplierId = supplierId
  }
  if (startDate || endDate) {
    where.receivedAt = {}
    const f = where.receivedAt as Record<string, Date>
    if (startDate) f.gte = new Date(startDate)
    if (endDate) f.lte = new Date(endDate + "T23:59:59.999Z")
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { receivedAt: "desc" },
      include: {
        supplier: { select: { legalName: true } },
        receivedBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.receipt.count({ where }),
  ])

  return NextResponse.json({ receipts, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!canRegisterInventoryReception(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const { deliveryNoteCode, supplierId, receivedAt, notes, lines } = receptionSchema.parse(await req.json())

    const existing = await prisma.receipt.findUnique({
      where: { deliveryNoteCode_supplierId: { deliveryNoteCode, supplierId } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una recepción con este código de albarán para este proveedor" },
        { status: 400 }
      )
    }

    const productIds = lines.map((l) => l.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isPurchasable: true,
        suppliers: { some: { supplierId } },
      },
      select: { id: true },
    })
    const validIds = new Set(products.map((p) => p.id))
    const invalidIds = productIds.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Productos no válidos, no comprables o no asociados al proveedor: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    const receipt = await prisma.$transaction(async (tx) => {
      const rec = await tx.receipt.create({
        data: {
          deliveryNoteCode,
          supplierId,
          receivedAt: new Date(receivedAt),
          receivedById: session.user.id,
          notes: notes || null,
          lines: {
            create: lines.map(
              (l) => ({
                productId: l.productId,
                receivedQuantity: l.receivedQuantity,
                unitPrice: l.unitPrice,
                batch: l.batch || null,
                dueDate: l.dueDate
                  ? new Date(l.dueDate)
                  : null,
              })
            ),
          },
        },
        include: {
          supplier: { select: { legalName: true } },
          lines: {
            include: {
              product: {
                select: { code: true, posDescription: true, purchaseUnit: true },
              },
            },
          },
        },
      })
      return rec
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message =
      error instanceof Error ? error.message : "Error al crear recepción"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
