import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildInvoiceAlerts, facturaSchema, normalizeNif } from "@/lib/facturas"
import { ensureAcreedorForProveedor } from "@/lib/pagos"

const lineData = (linea: ReturnType<typeof facturaSchema.parse>["lineas"][number], alertaValidacion: string | null) => ({
  productoId: linea.productoId || null,
  tipoLinea: linea.tipoLinea,
  referenciaProveedor: linea.referenciaProveedor || null,
  codigoArticulo: linea.codigoArticulo || null,
  descripcion: linea.descripcion,
  unidadMedida: linea.unidadMedida || null,
  formatoOriginal: linea.formatoOriginal || null,
  cantidad: linea.cantidad,
  descuentoPorcentaje: linea.descuentoPorcentaje ?? null,
  descuentoImporte: linea.descuentoImporte,
  precioUnitario: linea.precioUnitario,
  precioUnitarioNeto: linea.precioUnitarioNeto,
  baseImponible: linea.baseImponible,
  tipoIva: linea.tipoIva ?? null,
  cuotaIva: linea.cuotaIva,
  totalLinea: linea.totalLinea,
  lote: linea.lote || null,
  fechaVencimiento: linea.fechaVencimiento ? new Date(linea.fechaVencimiento) : null,
  alertaValidacion,
})

export const GET = withAuth(async (_req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await context.params
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      proveedor: { select: { id: true, razonSocial: true, cifNif: true, direccionFiscal: true } },
      confirmadoPor: { select: { name: true } },
      albaranes: { select: { id: true, codigoAlbaran: true, fechaRecepcion: true } },
      lineas: { include: { producto: { select: { id: true, codigo: true, descripcionTpv: true, umCompra: true } } }, orderBy: { createdAt: "asc" } },
      impuestos: { orderBy: { createdAt: "asc" } },
      adjuntos: { select: { id: true, nombreArchivo: true, mimeType: true } },
    },
  })
  if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  return NextResponse.json(factura)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Solo ADMIN puede editar facturas confirmadas" }, { status: 403 })
  const { id } = await context.params

  try {
    const existing = await prisma.factura.findUnique({ where: { id }, select: { id: true, estadoCircuito: true } })
    if (!existing) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    if (existing.estadoCircuito === "CONFORMADA" || existing.estadoCircuito === "PARCIALMENTE_CONFORMADA") return NextResponse.json({ error: "Una factura conformada debe corregirse mediante una incidencia o abono" }, { status: 409 })
    const parsed = facturaSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const data = parsed.data
    const serie = data.serie.trim()
    const recepcionIds = Array.from(new Set(data.recepcionIds))
    const proveedor = await prisma.proveedor.findUnique({ where: { id: data.proveedorId }, select: { id: true, cifNif: true } })
    if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 })
    if (normalizeNif(proveedor.cifNif) !== normalizeNif(data.nifEmisor)) return NextResponse.json({ error: "El NIF del emisor no coincide con el proveedor" }, { status: 400 })

    const duplicate = await prisma.factura.findFirst({ where: { proveedorId: data.proveedorId, serie, numero: data.numero, NOT: { id } }, select: { id: true } })
    if (duplicate) return NextResponse.json({ error: "Ya existe una factura con ese proveedor, serie y número" }, { status: 409 })

    const albaranes = recepcionIds.length
      ? await prisma.recepcion.findMany({
          where: { id: { in: recepcionIds }, proveedorId: data.proveedorId, OR: [{ facturaId: null }, { facturaId: id }] },
          include: { lineas: { include: { producto: { select: { codigo: true, descripcionTpv: true } } } } },
        })
      : []
    if (albaranes.length !== recepcionIds.length) return NextResponse.json({ error: "Uno o más albaranes no están disponibles para esta factura" }, { status: 409 })

    const productIds = Array.from(new Set(data.lineas.filter((linea) => linea.tipoLinea === "PRODUCTO").map((linea) => linea.productoId).filter(Boolean))) as string[]
    const products = await prisma.producto.findMany({ where: { id: { in: productIds } }, select: { id: true } })
    if (products.length !== productIds.length) return NextResponse.json({ error: "Toda línea de producto debe usar un producto del catálogo" }, { status: 400 })
    const validation = buildInvoiceAlerts(data, albaranes.flatMap((albaran) => albaran.lineas))

    const factura = await prisma.$transaction(async (tx) => {
      const acreedor = await ensureAcreedorForProveedor(tx, { id: data.proveedorId, razonSocial: data.razonSocialEmisor, cifNif: data.nifEmisor }, session.user.id)
      await tx.recepcion.updateMany({ where: { facturaId: id }, data: { facturaId: null } })
      if (recepcionIds.length) await tx.recepcion.updateMany({ where: { id: { in: recepcionIds }, facturaId: null }, data: { facturaId: id } })
      return tx.factura.update({
        where: { id },
        data: {
          proveedorId: data.proveedorId,
          acreedorId: acreedor.id,
          entidad: data.entidad,
          tipoDocumento: data.tipoDocumento,
          estadoCircuito: "BORRADOR",
          importeConformado: null,
          importeRetenido: 0,
          motivoRetencion: null,
          referenciaOrigen: null,
          serie,
          numero: data.numero,
          fechaExpedicion: new Date(data.fechaExpedicion),
          fechaOperacion: data.fechaOperacion ? new Date(data.fechaOperacion) : null,
          fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
          fechaPago: data.fechaPago ? new Date(data.fechaPago) : null,
          numeroPedido: data.numeroPedido || null,
          fechaPedido: data.fechaPedido ? new Date(data.fechaPedido) : null,
          centroEntrega: data.centroEntrega || null,
          referenciaAlbaran: data.referenciaAlbaran || null,
          fechaAlbaran: data.fechaAlbaran ? new Date(data.fechaAlbaran) : null,
          formaPago: data.formaPago || null,
          estadoPago: "PENDIENTE",
          importePagado: data.importePagado ?? null,
          razonSocialEmisor: data.razonSocialEmisor,
          nifEmisor: data.nifEmisor,
          domicilioFiscalEmisor: data.domicilioFiscalEmisor,
          totalNeto: data.totalNeto,
          totalDescuento: data.totalDescuento,
          totalIva: data.totalIva,
          totalRecargo: data.totalRecargo,
          totalRetenciones: data.totalRetenciones,
          importeTotal: data.importeTotal,
          observaciones: data.observaciones || null,
          alertas: validation.alerts.length ? validation.alerts : undefined,
          confirmadoPorId: session.user.id,
          confirmadoAt: new Date(),
          lineas: { deleteMany: {}, create: data.lineas.map((linea, index) => lineData(linea, validation.lineAlerts.get(index) || null)) },
          impuestos: { deleteMany: {}, create: data.impuestos.map((impuesto) => impuesto) },
        },
      })
    })
    return NextResponse.json({ factura, alertas: validation.alerts })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al editar factura" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_req, session, context) => {
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Solo ADMIN puede eliminar facturas" }, { status: 403 })
  const { id } = await context.params
  const existing = await prisma.factura.findUnique({ where: { id }, select: { id: true, estado: true } })
  if (!existing) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  const factura = await prisma.factura.update({ where: { id }, data: { estado: "ANULADA" } })
  return NextResponse.json({ ok: true, factura })
})
