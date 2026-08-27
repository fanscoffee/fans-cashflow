import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const DELETE = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const result = await prisma.producto.deleteMany({
      where: { esEjemplo: true },
    })

    return NextResponse.json({
      ok: true,
      eliminados: result.count,
      message: `${result.count} productos de ejemplo eliminados`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al limpiar ejemplos"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
