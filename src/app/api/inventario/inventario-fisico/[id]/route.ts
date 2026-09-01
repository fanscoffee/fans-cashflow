import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await context.params

  const inventario = await prisma.inventarioFisico.findUnique({
    where: { id },
    include: {
      creadoBy: { select: { name: true } },
      lineas: {
        include: {
          producto: {
            select: {
              id: true,
              codigo: true,
              descripcionTpv: true,
              umCompra: true,
              umBaseStock: true,
              factorCompraABase: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!inventario) {
    return NextResponse.json(
      { error: "Inventario no encontrado" },
      { status: 404 }
    )
  }

  return NextResponse.json(inventario)
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden eliminar inventarios" },
      { status: 403 }
    )
  }

  const { id } = await context.params

  try {
    const existing = await prisma.inventarioFisico.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Inventario no encontrado" },
        { status: 404 }
      )
    }

    await prisma.inventarioFisico.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al eliminar inventario"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
