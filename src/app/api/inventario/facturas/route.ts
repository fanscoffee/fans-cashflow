import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { buildInvoiceAlerts, facturaSchema, normalizeNif } from "@/lib/facturas"
import { ensureAcreedorForProveedor } from "@/lib/pagos"

const allowedRoles = ["ADMIN", "SOCIO"]

function canAccess(role: string) {
  return allowedRoles.includes(role)
}

function lineData(linea: ReturnType<typeof facturaSchema.parse>["lineas"][number], alertaValidacion: string | null) {
  return {
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
  }
}

export const GET = withAuth(async (req, session) => {
  if (!canAccess(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const proveedorId = searchParams.get("proveedorId") || ""
  const estado = searchParams.get("estado") || ""
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)))
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { numero: { contains: search, mode: "insensitive" } },
      { serie: { contains: search, mode: "insensitive" } },
      { nifEmisor: { contains: search, mode: "insensitive" } },
      { razonSocialEmisor: { contains: search, mode: "insensitive" } },
    ]
  }
  if (proveedorId) where.proveedorId = proveedorId
  if (estado) where.estado = estado

  const [facturas, total] = await Promise.all([
    prisma.factura.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ fechaExpedicion: "desc" }, { createdAt: "desc" }],
      include: {
        proveedor: { select: { id: true, razonSocial: true, cifNif: true } },
        confirmadoPor: { select: { name: true } },
        _count: { select: { lineas: true, albaranes: true } },
      },
    }),
    prisma.factura.count({ where }),
  ])

  return NextResponse.json({ facturas, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!canAccess(session.user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    const parsed = facturaSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    const data = parsed.data
    const serie = data.serie.trim()
    const recepcionIds = Array.from(new Set(data.recepcionIds))

    const proveedor = await prisma.proveedor.findUnique({
      where: { id: data.proveedorId },
      select: { id: true, razonSocial: true, cifNif: true, direccionFiscal: true },
    })
    if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 400 })
    if (normalizeNif(proveedor.cifNif) !== normalizeNif(data.nifEmisor)) {
      return NextResponse.json({ error: "El NIF del emisor no coincide con el proveedor" }, { status: 400 })
    }

    const duplicate = await prisma.factura.findUnique({
      where: { proveedorId_serie_numero: { proveedorId: data.proveedorId, serie, numero: data.numero } },
      select: { id: true },
    })
    if (duplicate) return NextResponse.json({ error: "Ya existe una factura con ese proveedor, serie y número" }, { status: 409 })

    const albaranes = recepcionIds.length
      ? await prisma.recepcion.findMany({
          where: { id: { in: recepcionIds }, proveedorId: data.proveedorId, facturaId: null },
          include: { lineas: { include: { producto: { select: { codigo: true, descripcionTpv: true } } } } },
        })
      : []
    if (albaranes.length !== recepcionIds.length) {
      return NextResponse.json({ error: "Uno o más albaranes ya están vinculados, no existen o pertenecen a otro proveedor" }, { status: 409 })
    }

    const productIds = Array.from(new Set(data.lineas.filter((linea) => linea.tipoLinea === "PRODUCTO").map((linea) => linea.productoId).filter(Boolean))) as string[]
    const products = await prisma.producto.findMany({ where: { id: { in: productIds } }, select: { id: true } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Toda línea de producto debe usar un producto del catálogo" }, { status: 400 })
    }

    const albaranLineas = albaranes.flatMap((albaran) => albaran.lineas)
    const validation = buildInvoiceAlerts(data, albaranLineas)
    const alertas = validation.alerts

    const factura = await prisma.$transaction(async (tx) => {
      const acreedor = await ensureAcreedorForProveedor(tx, proveedor, session.user.id)
      const created = await tx.factura.create({
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
          estado: "CONFIRMADA",
          estadoPago: "PENDIENTE",
          moneda: "EUR",
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
          alertas: alertas.length ? alertas : undefined,
          confirmadoPorId: session.user.id,
          lineas: { create: data.lineas.map((linea, index) => lineData(linea, validation.lineAlerts.get(index) || null)) },
          impuestos: { create: data.impuestos.map((impuesto) => impuesto) },
        },
      })

      if (recepcionIds.length) {
        const linked = await tx.recepcion.updateMany({ where: { id: { in: recepcionIds }, facturaId: null }, data: { facturaId: created.id } })
        if (linked.count !== recepcionIds.length) throw new Error("Los albaranes cambiaron durante el alta")
      }
      return created
    })

    return NextResponse.json({ factura, alertas }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al crear factura" }, { status: 500 })
  }
})
