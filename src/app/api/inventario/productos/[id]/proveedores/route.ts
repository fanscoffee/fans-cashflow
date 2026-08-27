import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const relaciones = await prisma.proveedorProducto.findMany({
    where: { productoId: id },
    include: { proveedor: true },
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
    const body = await req.json()

    const existing = await prisma.proveedorProducto.findUnique({
      where: { proveedorId_productoId: { proveedorId: body.proveedorId, productoId: id } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Este proveedor ya está asignado a este producto" },
        { status: 400 }
      )
    }

    if (body.esPrincipal) {
      await prisma.proveedorProducto.updateMany({
        where: { productoId: id, esPrincipal: true },
        data: { esPrincipal: false },
      })
    }

    const relation = await prisma.proveedorProducto.create({
      data: {
        proveedorId: body.proveedorId,
        productoId: id,
        refProveedor: body.refProveedor || null,
        precioCompraSinIva: body.precioCompraSinIva || null,
        plazoEntregaDias: body.plazoEntregaDias || null,
        pedidoMinimo: body.pedidoMinimo || null,
        esPrincipal: body.esPrincipal || false,
      },
      include: { proveedor: true },
    })

    return NextResponse.json(relation, { status: 201 })
  } catch (error) {
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
    const body = await req.json()
    const { relationId, ...data } = body

    if (data.esPrincipal) {
      await prisma.proveedorProducto.updateMany({
        where: { productoId: id, esPrincipal: true, id: { not: relationId } },
        data: { esPrincipal: false },
      })
    }

    const relation = await prisma.proveedorProducto.update({
      where: { id: relationId },
      data,
      include: { proveedor: true },
    })

    return NextResponse.json(relation)
  } catch (error) {
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

    if (relationId) {
      await prisma.proveedorProducto.delete({ where: { id: relationId } })
    } else {
      const body = await req.json()
      await prisma.proveedorProducto.delete({
        where: { proveedorId_productoId: { proveedorId: body.proveedorId, productoId: id } },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al desasignar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
