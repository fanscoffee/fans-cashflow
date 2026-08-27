import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toN } from "@/lib/money"
import { withAuth } from "@/lib/with-auth"

function monthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

export const GET = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = Number(searchParams.get("month") || now.getMonth() + 1)
  const year = Number(searchParams.get("year") || now.getFullYear())
  const { start, end } = monthBounds(year, month)

  const [conteoActual, turnos] = await Promise.all([
    prisma.inventarioFisico.findFirst({
      where: { fechaConteo: { gte: start, lt: end } },
      orderBy: { fechaConteo: "desc" },
      include: {
        lineas: {
          include: {
            producto: {
              select: {
                id: true,
                esVendible: true,
                pvpAplicadoSinIva: true,
                factorVentaABase: true,
                factorCompraABase: true,
                umCompra: true,
                umBaseStock: true,
                umVenta: true,
              },
            },
          },
        },
      },
    }),
    prisma.shift.findMany({
      where: { date: { gte: start, lt: end }, status: "CERRADO" },
      select: { cierreTurno: { select: { ventasNetas: true } } },
    }),
  ])

  const ventaReal = turnos.reduce((total, shift) => {
    return total + (shift.cierreTurno ? toN(shift.cierreTurno.ventasNetas) : 0)
  }, 0)
  const turnosConCierre = turnos.filter((shift) => shift.cierreTurno).length
  const turnosSinCierre = turnos.length - turnosConCierre

  if (!conteoActual) {
    return NextResponse.json({
      estado: "INCOMPLETO",
      periodo: { month, year },
      conteos: { actual: null, anterior: null },
      resumen: {
        ventaTeorica: 0,
        ventaReal,
        diferencia: null,
        diferenciaPct: null,
        turnosConCierre,
        turnosSinCierre,
        productosValorizados: 0,
        productosPendientes: 0,
        ajustesInventario: 0,
      },
      advertencias: ["No existe un conteo físico registrado para este mes."],
    })
  }

  const conteoAnterior = await prisma.inventarioFisico.findFirst({
    where: { fechaConteo: { lt: conteoActual.fechaConteo } },
    orderBy: { fechaConteo: "desc" },
    include: {
      lineas: { select: { productoId: true, cantidadUm2: true } },
    },
  })

  if (!conteoAnterior) {
    return NextResponse.json({
      estado: "INCOMPLETO",
      periodo: { month, year },
      conteos: {
        actual: { id: conteoActual.id, fechaConteo: conteoActual.fechaConteo },
        anterior: null,
      },
      resumen: {
        ventaTeorica: 0,
        ventaReal,
        diferencia: null,
        diferenciaPct: null,
        turnosConCierre,
        turnosSinCierre,
        productosValorizados: 0,
        productosPendientes: 0,
        ajustesInventario: 0,
      },
      advertencias: ["No existe un conteo físico anterior para comparar."],
    })
  }

  const previousByProduct = new Map(
    conteoAnterior.lineas.map((linea) => [linea.productoId, toN(linea.cantidadUm2)])
  )
  const productIds = conteoActual.lineas.map((linea) => linea.productoId)
  const recepciones = await prisma.recepcionLinea.findMany({
    where: {
      productoId: { in: productIds },
      recepcion: {
        fechaRecepcion: {
          gt: conteoAnterior.fechaConteo,
          lte: conteoActual.fechaConteo,
        },
      },
    },
    select: {
      productoId: true,
      cantidadRecibida: true,
      producto: {
        select: {
          factorCompraABase: true,
          umCompra: true,
          umBaseStock: true,
        },
      },
    },
  })

  const receivedByProduct = new Map<string, number>()
  const receiptConversionMissing = new Set<string>()
  for (const recepcion of recepciones) {
    const sameUnit = recepcion.producto.umCompra === recepcion.producto.umBaseStock
    const factor = toN(recepcion.producto.factorCompraABase) || (sameUnit ? 1 : 0)
    if (factor <= 0) {
      receiptConversionMissing.add(recepcion.productoId)
      continue
    }
    receivedByProduct.set(
      recepcion.productoId,
      (receivedByProduct.get(recepcion.productoId) || 0) + toN(recepcion.cantidadRecibida) * factor
    )
  }

  let ventaTeorica = 0
  let productosValorizados = 0
  let productosPendientes = 0
  let ajustesInventario = 0

  for (const linea of conteoActual.lineas) {
    if (!linea.producto.esVendible) continue

    const pvpSinIva = toN(linea.producto.pvpAplicadoSinIva)
    const factorVenta = toN(linea.producto.factorVentaABase)
    const sameSaleUnit = linea.producto.umVenta === linea.producto.umBaseStock
    const validFactorVenta = factorVenta > 0 || sameSaleUnit
    const hasReceiptIssue = receiptConversionMissing.has(linea.productoId)
    if (pvpSinIva <= 0 || !validFactorVenta || hasReceiptIssue) {
      productosPendientes += 1
      continue
    }

    const current = toN(linea.cantidadUm2)
    const previous = previousByProduct.get(linea.productoId) || 0
    const received = receivedByProduct.get(linea.productoId) || 0
    const salidaBase = previous + received - current
    if (salidaBase < 0) ajustesInventario += 1

    const unitsPerSale = factorVenta > 0 ? factorVenta : 1
    ventaTeorica += Math.max(0, salidaBase / unitsPerSale) * pvpSinIva
    productosValorizados += 1
  }

  const diferencia = ventaReal - ventaTeorica
  const diferenciaPct = ventaTeorica > 0 ? (diferencia / ventaTeorica) * 100 : null
  const advertencias: string[] = []
  if (productosPendientes > 0) {
    advertencias.push(`${productosPendientes} producto(s) vendible(s) no tienen configuración suficiente para valorarse.`)
  }
  if (ajustesInventario > 0) {
    advertencias.push(`${ajustesInventario} producto(s) tienen un aumento de inventario no explicado por recepciones.`)
  }
  if (turnosSinCierre > 0) {
    advertencias.push(`${turnosSinCierre} turno(s) cerrado(s) no tienen ticket confirmado y no se han incluido en la venta real.`)
  }

  return NextResponse.json({
    estado: "OK",
    periodo: { month, year },
    conteos: {
      actual: { id: conteoActual.id, fechaConteo: conteoActual.fechaConteo },
      anterior: { id: conteoAnterior.id, fechaConteo: conteoAnterior.fechaConteo },
    },
    resumen: {
      ventaTeorica,
      ventaReal,
      diferencia,
      diferenciaPct,
      turnosConCierre,
      turnosSinCierre,
      productosValorizados,
      productosPendientes,
      ajustesInventario,
    },
    advertencias,
  })
})
