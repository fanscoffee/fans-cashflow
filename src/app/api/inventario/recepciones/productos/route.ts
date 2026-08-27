import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async () => {
  const productos = await prisma.producto.findMany({
    where: {
      esComprable: true,
      estado: "Activo",
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
