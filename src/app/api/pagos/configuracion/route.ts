import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { paymentErrorResponse, parseEntity } from "@/lib/pagos-http"
import { requirePaymentFunction } from "@/lib/pagos"

export const GET = withAuth(async (req, session) => {
  const entity = parseEntity(new URL(req.url).searchParams.get("entidad"))
  try {
    await requirePaymentFunction(session.user.id, "SOLICITAR", entity, session.user.role)
    const [categorias, acreedores, cuentas, medios] = await Promise.all([
      prisma.categoriaGasto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
      prisma.acreedor.findMany({ where: { estado: "ACTIVO" }, select: { id: true, codigo: true, nombre: true, tipo: true, entidadHabitual: true, cuentaDestinoUltimos4: true }, orderBy: { nombre: "asc" } }),
      prisma.cuentaFondos.findMany({ where: { ...(entity ? { entidad: entity } : {}), estado: "ACTIVA" }, select: { id: true, tipo: true, entidad: true, descripcion: true, ibanUltimos4: true, saldoTeorico: true, fondoFijo: true }, orderBy: [{ entidad: "asc" }, { id: "asc" }] }),
      prisma.medioPago.findMany({ where: { estado: "ACTIVO" }, select: { id: true, tipo: true, requiereCuenta: true, conciliableBanco: true, limiteOperacion: true }, orderBy: { id: "asc" } }),
    ])
    return NextResponse.json({ categorias, acreedores, cuentas, medios, entidades: ["OBRADOR", "CAFETERIA"] })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
