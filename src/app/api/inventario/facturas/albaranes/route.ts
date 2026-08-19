import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const proveedorId = searchParams.get("proveedorId") || ""
  const facturaId = searchParams.get("facturaId") || ""
  const search = searchParams.get("search") || ""
  if (!proveedorId) return NextResponse.json({ albaranes: [] })

  const albaranes = await prisma.recepcion.findMany({
    where: {
      proveedorId,
      ...(facturaId ? { OR: [{ facturaId: null }, { facturaId }] } : { facturaId: null }),
      ...(search ? { codigoAlbaran: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { fechaRecepcion: "desc" },
    take: 100,
    select: {
      id: true,
      codigoAlbaran: true,
      fechaRecepcion: true,
      lineas: {
        select: {
          productoId: true,
          cantidadRecibida: true,
          precioUnitario: true,
          producto: { select: { codigo: true, descripcionTpv: true, umCompra: true } },
        },
      },
    },
  })

  return NextResponse.json({ albaranes })
})
