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
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo los administradores pueden eliminar proveedores" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const count = await prisma.proveedorProducto.count({
      where: { proveedorId: id },
    })
    if (count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${count} producto(s) asignado(s). Desactívalo en su lugar.` },
        { status: 400 }
      )
    }

    await prisma.proveedor.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el proveedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
