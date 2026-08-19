import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()

    if (body.valor) {
      const existing = await prisma.catalogo.findFirst({
        where: {
          tipo: body.tipo || undefined,
          valor: body.valor,
          id: { not: id },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: `Ya existe ese valor en el catálogo` },
          { status: 400 }
        )
      }
    }

    const catalogo = await prisma.catalogo.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(catalogo)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo los administradores pueden eliminar catálogos" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    await prisma.catalogo.update({
      where: { id },
      data: { activo: false },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al desactivar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
