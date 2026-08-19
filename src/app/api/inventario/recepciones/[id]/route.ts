import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const recepcion = await prisma.recepcion.findUnique({
    where: { id },
    include: {
      proveedor: { select: { id: true, razonSocial: true, cifNif: true } },
      recibidoBy: { select: { name: true } },
      lineas: {
        include: {
          producto: {
            select: {
              id: true,
              codigo: true,
              descripcionTpv: true,
              umCompra: true,
              tipoArticulo: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!recepcion) {
    return NextResponse.json(
      { error: "Recepción no encontrada" },
      { status: 404 }
    )
  }

  return NextResponse.json(recepcion)
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const existing = await prisma.recepcion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Recepción no encontrada" },
        { status: 404 }
      )
    }

    await prisma.recepcion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al eliminar recepción"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
