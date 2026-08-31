import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { canRegisterInventoryReception } from "@/lib/inventory-permissions"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const proveedorId = searchParams.get("proveedorId") || ""
  const fechaDesde = searchParams.get("fechaDesde") || ""
  const fechaHasta = searchParams.get("fechaHasta") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "20")

  const where: Record<string, unknown> = {}

  if (search) {
    where.codigoAlbaran = { contains: search, mode: "insensitive" }
  }
  if (proveedorId) {
    where.proveedorId = proveedorId
  }
  if (fechaDesde || fechaHasta) {
    where.fechaRecepcion = {}
    const f = where.fechaRecepcion as Record<string, Date>
    if (fechaDesde) f.gte = new Date(fechaDesde)
    if (fechaHasta) f.lte = new Date(fechaHasta + "T23:59:59.999Z")
  }

  const [recepciones, total] = await Promise.all([
    prisma.recepcion.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { fechaRecepcion: "desc" },
      include: {
        proveedor: { select: { razonSocial: true } },
        recibidoBy: { select: { name: true } },
        _count: { select: { lineas: true } },
      },
    }),
    prisma.recepcion.count({ where }),
  ])

  return NextResponse.json({ recepciones, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!canRegisterInventoryReception(session.user)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { codigoAlbaran, proveedorId, fechaRecepcion, notas, lineas } = body

    if (!codigoAlbaran || !proveedorId || !fechaRecepcion || !lineas?.length) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      )
    }

    const existing = await prisma.recepcion.findUnique({
      where: { codigoAlbaran_proveedorId: { codigoAlbaran, proveedorId } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una recepción con este código de albarán para este proveedor" },
        { status: 400 }
      )
    }

    const productoIds = lineas.map((l: { productoId: string }) => l.productoId)
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: productoIds },
        esComprable: true,
        proveedores: { some: { proveedorId } },
      },
      select: { id: true },
    })
    const validIds = new Set(productos.map((p) => p.id))
    const invalidIds = productoIds.filter((id: string) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Productos no válidos, no comprables o no asociados al proveedor: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    const recepcion = await prisma.$transaction(async (tx) => {
      const rec = await tx.recepcion.create({
        data: {
          codigoAlbaran,
          proveedorId,
          fechaRecepcion: new Date(fechaRecepcion),
          recibidoById: session.user.id,
          notas: notas || null,
          lineas: {
            create: lineas.map(
              (l: {
                productoId: string
                cantidadRecibida: number
                precioUnitario: number
                lote?: string
                fechaVencimiento?: string
              }) => ({
                productoId: l.productoId,
                cantidadRecibida: l.cantidadRecibida,
                precioUnitario: l.precioUnitario,
                lote: l.lote || null,
                fechaVencimiento: l.fechaVencimiento
                  ? new Date(l.fechaVencimiento)
                  : null,
              })
            ),
          },
        },
        include: {
          proveedor: { select: { razonSocial: true } },
          lineas: {
            include: {
              producto: {
                select: { codigo: true, descripcionTpv: true, umCompra: true },
              },
            },
          },
        },
      })
      return rec
    })

    return NextResponse.json(recepcion, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear recepción"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
