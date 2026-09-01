import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse } from "@/lib/pagos-http"
import { requirePaymentFunction } from "@/lib/pagos"
import { parseEntity } from "@/lib/pagos-http"

export const GET = withAuth(async (req, session) => {
  try {
    const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
    await requirePaymentFunction(session.user.id, "EJECUTAR", entity, session.user.role)
    const [facturas, gastos] = await Promise.all([
      prisma.factura.findMany({
        where: { ...(entity ? { entidad: entity } : {}), estadoCircuito: { in: ["CONFORMADA", "PARCIALMENTE_CONFORMADA"] }, acreedorId: { not: null } },
        include: { acreedor: { select: { id: true, codigo: true, nombre: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } }, select: { importeAplicado: true } }, adjuntos: { select: { id: true, nombreArchivo: true, mimeType: true } } },
        orderBy: [{ fechaVencimiento: "asc" }, { createdAt: "asc" }],
      }),
      prisma.gastoCorriente.findMany({
        where: { ...(entity ? { entidad: entity } : {}), estado: "AUTORIZADO" },
        include: { categoria: true, acreedor: { select: { id: true, codigo: true, nombre: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } }, select: { importeAplicado: true } } },
        orderBy: { fechaDevengo: "asc" },
      }),
    ])
    return NextResponse.json({ facturas, gastos })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
