import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params
  const producto = await prisma.producto.findUnique({ where: { id } })

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  return NextResponse.json(producto)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()

    if (body.codigo) {
      const conflict = await prisma.producto.findFirst({
        where: { codigo: body.codigo, id: { not: id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Ya existe otro producto con el código ${body.codigo}` },
          { status: 400 }
        )
      }
    }

    const producto = await prisma.producto.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(producto)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo los administradores pueden eliminar productos" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    await prisma.producto.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
