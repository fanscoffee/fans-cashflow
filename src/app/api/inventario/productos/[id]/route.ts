import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { getProductTypeBehavior } from "@/lib/product-types"

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

    const current = await prisma.producto.findUnique({
      where: { id },
      select: { codigo: true, tipoArticulo: true, familia: true },
    })
    if (!current) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (body.codigo !== undefined && body.codigo !== current.codigo) {
      return NextResponse.json({ error: "El código de producto es inmutable" }, { status: 400 })
    }
    if (body.tipoArticulo !== undefined && body.tipoArticulo !== current.tipoArticulo) {
      return NextResponse.json({ error: "El tipo de artículo es inmutable" }, { status: 400 })
    }
    if (body.familia !== undefined && body.familia !== current.familia) {
      return NextResponse.json({ error: "La familia es inmutable porque forma parte del código" }, { status: 400 })
    }

    const productData = { ...body }
    delete productData.confirmarDuplicado
    const behavior = getProductTypeBehavior(current.tipoArticulo)
    if (behavior) Object.assign(productData, behavior)

    const producto = await prisma.producto.update({
      where: { id },
      data: productData,
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
