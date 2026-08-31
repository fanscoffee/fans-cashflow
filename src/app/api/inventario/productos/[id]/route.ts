import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { getProductTypeBehavior } from "@/lib/product-types"
import { calculateProductPricing } from "@/lib/product-pricing"
import { canDeleteInventoryItems } from "@/lib/inventory-permissions"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params
  const producto = await prisma.producto.findUnique({ where: { id } })

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  return NextResponse.json(producto)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()

    const current = await prisma.producto.findUnique({
      where: { id },
      select: {
        codigo: true,
        tipoArticulo: true,
        familia: true,
        costeUmBase: true,
        ivaPct: true,
        ivaCompraPct: true,
        ivaVentaPct: true,
        metodoPrecio: true,
        margenObjetivoPct: true,
        pvpFijoConIva: true,
        pvpAplicadoConIva: true,
      },
    })
    if (!current) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (body.codigo !== undefined && body.codigo !== current.codigo) {
      return NextResponse.json({ error: "El código de producto es inmutable" }, { status: 400 })
    }
    if (body.tipoArticulo !== undefined && body.tipoArticulo !== current.tipoArticulo) {
      return NextResponse.json({ error: "El tipo de artículo es inmutable" }, { status: 400 })
    }
    if (body.familia !== undefined && body.familia !== current.familia) {
      return NextResponse.json({ error: "La familia es inmutable porque forma parte del código" }, { status: 400 })
    }

    const productData = { ...body }
    delete productData.confirmarDuplicado
    const behavior = getProductTypeBehavior(current.tipoArticulo)
    if (behavior) Object.assign(productData, behavior)
    const pricing = calculateProductPricing({
      costeSinIva: Object.prototype.hasOwnProperty.call(body, "costeUmBase") ? body.costeUmBase : current.costeUmBase,
      ivaCompraPct: Object.prototype.hasOwnProperty.call(body, "ivaCompraPct") ? body.ivaCompraPct : current.ivaCompraPct,
      ivaVentaPct: Object.prototype.hasOwnProperty.call(body, "ivaVentaPct") ? body.ivaVentaPct : current.ivaVentaPct,
      ivaPct: Object.prototype.hasOwnProperty.call(body, "ivaPct") ? body.ivaPct : current.ivaPct,
      metodoPrecio: Object.prototype.hasOwnProperty.call(body, "metodoPrecio") ? body.metodoPrecio : current.metodoPrecio,
      margenObjetivoPct: Object.prototype.hasOwnProperty.call(body, "margenObjetivoPct") ? body.margenObjetivoPct : current.margenObjetivoPct,
      pvpVentaConIva: Object.prototype.hasOwnProperty.call(body, "pvpAplicadoConIva") ? body.pvpAplicadoConIva : current.pvpAplicadoConIva ?? current.pvpFijoConIva,
    })
    Object.assign(productData, {
      ivaCompraPct: pricing.ivaCompraPct,
      ivaVentaPct: pricing.ivaVentaPct,
      ivaPct: pricing.ivaPct,
      costeConIva: pricing.costeConIva,
      pvpObjetivoConIva: pricing.pvpObjetivoConIva,
      pvpFijoConIva: pricing.pvpFijoConIva,
      pvpAplicadoConIva: pricing.pvpAplicadoConIva,
      pvpAplicadoSinIva: pricing.pvpVentaSinIva,
      gananciaEurUd: pricing.gananciaEurUd,
      margenRealPct: pricing.margenRealPct,
      desviacionPp: pricing.desviacionPp,
      diferenciaEurUd: pricing.diferenciaEurUd,
      diagnosticoPrecio: pricing.diagnosticoPrecio,
    })

    const producto = await prisma.producto.update({
      where: { id },
      data: productData,
    })

    return NextResponse.json(producto)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!canDeleteInventoryItems(session.user)) {
    return NextResponse.json({ error: "Solo ADMIN o el socio Yomi pueden eliminar productos" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    await prisma.producto.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
