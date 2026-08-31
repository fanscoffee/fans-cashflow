import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req) => {
  const proveedorId = new URL(req.url).searchParams.get("proveedorId")

  if (!proveedorId) {
    return NextResponse.json({ productos: [] })
  }

  const productos = await prisma.producto.findMany({
    where: {
      esComprable: true,
      estado: "Activo",
      proveedores: { some: { proveedorId } },
    },
    select: {
      id: true,
      codigo: true,
      descripcionTpv: true,
      umCompra: true,
      costeUmBase: true,
    },
    orderBy: { codigo: "asc" },
  })

  return NextResponse.json({ productos })
})
