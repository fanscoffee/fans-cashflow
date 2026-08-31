import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params
  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    include: {
      productos: {
        include: { producto: true },
      },
    },
  })

  if (!proveedor) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
  }

  return NextResponse.json(proveedor)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()

    if (body.cifNif) {
      const conflict = await prisma.proveedor.findFirst({
        where: { cifNif: body.cifNif, id: { not: id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Ya existe otro proveedor con el CIF/NIF ${body.cifNif}` },
          { status: 400 }
        )
      }
    }

    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(proveedor)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "Solo los administradores y socios pueden eliminar proveedores" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const proveedor = await prisma.proveedor.findUnique({ where: { id }, select: { id: true } })
    if (!proveedor) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const [productos, recepciones, facturas, acreedores] = await Promise.all([
      prisma.proveedorProducto.count({ where: { proveedorId: id } }),
      prisma.recepcion.count({ where: { proveedorId: id } }),
      prisma.factura.count({ where: { proveedorId: id } }),
      prisma.acreedor.count({ where: { proveedorId: id } }),
    ])
    const vinculaciones = { productos, recepciones, facturas, acreedores }
    const totalVinculaciones = Object.values(vinculaciones).reduce((total, count) => total + count, 0)

    if (totalVinculaciones > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar el proveedor porque todavía tiene vinculaciones.",
          code: "PROVIDER_HAS_LINKS",
          vinculaciones,
        },
        { status: 409 }
      )
    }

    await prisma.proveedor.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
