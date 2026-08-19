import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const productos = await prisma.producto.findMany({
    where: {
      esComprable: true,
      ...(search ? {
        OR: [
          { codigo: { contains: search, mode: "insensitive" } },
          { descripcionTpv: { contains: search, mode: "insensitive" } },
          { descripcionCompleta: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { codigo: "asc" },
    take: 100,
    select: { id: true, codigo: true, descripcionTpv: true, umCompra: true, umBaseStock: true },
  })
  return NextResponse.json({ productos })
})
