import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const optionalNumber = (schema: z.ZodType<number>) => z.preprocess(
  (value) => value === null || value === "" ? undefined : value,
  schema.optional(),
) as z.ZodType<number | undefined>

const relationFields = {
  refProveedor: z.string().trim().max(120).nullable().optional(),
  precioCompraSinIva: optionalNumber(z.coerce.number().finite().min(0)),
  plazoEntregaDias: optionalNumber(z.coerce.number().int().min(0)),
  pedidoMinimo: optionalNumber(z.coerce.number().finite().min(0)),
  esPrincipal: z.boolean().optional(),
  activo: z.boolean().optional(),
}

const createRelationSchema = z.object({
  proveedorId: z.string().min(1),
  ...relationFields,
}).strict()

const updateRelationSchema = z.object({
  relationId: z.string().min(1),
  ...relationFields,
}).strict()

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const producto = await prisma.producto.findUnique({ where: { id }, select: { id: true } })
  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

  const relaciones = await prisma.proveedorProducto.findMany({
    where: { productoId: id },
    include: { proveedor: { select: { id: true, razonSocial: true, cifNif: true } } },
    orderBy: { esPrincipal: "desc" },
  })

  return NextResponse.json(relaciones)
})

export const POST = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const input = createRelationSchema.parse(await req.json())
    const [producto, proveedor] = await Promise.all([
      prisma.producto.findUnique({ where: { id }, select: { id: true } }),
      prisma.proveedor.findUnique({ where: { id: input.proveedorId }, select: { id: true, estado: true } }),
    ])
    if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    if (!proveedor || proveedor.estado !== "Activo") return NextResponse.json({ error: "Proveedor no disponible" }, { status: 409 })

    const existing = await prisma.proveedorProducto.findUnique({
      where: { proveedorId_productoId: { proveedorId: input.proveedorId, productoId: id } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Este proveedor ya está asignado a este producto" },
        { status: 400 }
      )
    }

    const relation = await prisma.$transaction(async (tx) => {
      if (input.esPrincipal) {
        await tx.proveedorProducto.updateMany({
          where: { productoId: id, esPrincipal: true },
          data: { esPrincipal: false },
        })
      }

      return tx.proveedorProducto.create({
        data: {
          proveedorId: input.proveedorId,
          productoId: id,
          refProveedor: input.refProveedor || null,
          precioCompraSinIva: input.precioCompraSinIva ?? null,
          plazoEntregaDias: input.plazoEntregaDias ?? null,
          pedidoMinimo: input.pedidoMinimo ?? null,
          esPrincipal: input.esPrincipal || false,
          activo: input.activo ?? true,
        },
        include: { proveedor: { select: { id: true, razonSocial: true, cifNif: true } } },
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
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const input = updateRelationSchema.parse(await req.json())
    const { relationId, ...data } = input
    const existing = await prisma.proveedorProducto.findFirst({ where: { id: relationId, productoId: id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Relación no encontrada" }, { status: 404 })

    if (data.esPrincipal) {
      await prisma.proveedorProducto.updateMany({
        where: { productoId: id, esPrincipal: true, id: { not: relationId } },
        data: { esPrincipal: false },
      })
    }

    const relation = await prisma.proveedorProducto.update({
      where: { id: relationId },
      data: {
        ...(data.refProveedor !== undefined && { refProveedor: data.refProveedor || null }),
        ...(data.precioCompraSinIva !== undefined && { precioCompraSinIva: data.precioCompraSinIva ?? null }),
        ...(data.plazoEntregaDias !== undefined && { plazoEntregaDias: data.plazoEntregaDias ?? null }),
        ...(data.pedidoMinimo !== undefined && { pedidoMinimo: data.pedidoMinimo ?? null }),
        ...(data.esPrincipal !== undefined && { esPrincipal: data.esPrincipal }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
      include: { proveedor: { select: { id: true, razonSocial: true, cifNif: true } } },
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
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

    const { id } = await context.params

  try {
    const { searchParams } = new URL(req.url)
    const relationId = searchParams.get("relationId")

    let relationToDelete = relationId
    if (!relationToDelete) {
      const body = await req.json()
      relationToDelete = z.object({ proveedorId: z.string().min(1) }).parse(body).proveedorId
      const relation = await prisma.proveedorProducto.findUnique({
        where: { proveedorId_productoId: { proveedorId: relationToDelete, productoId: id } },
        select: { id: true },
      })
      relationToDelete = relation?.id || null
    } else {
      const relation = await prisma.proveedorProducto.findFirst({ where: { id: relationToDelete, productoId: id }, select: { id: true } })
      relationToDelete = relation?.id || null
    }
    if (!relationToDelete) return NextResponse.json({ error: "Relación no encontrada" }, { status: 404 })
    await prisma.proveedorProducto.delete({ where: { id: relationToDelete } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al desasignar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
