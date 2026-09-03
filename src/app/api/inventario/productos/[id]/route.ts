import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { getProductTypeBehavior } from "@/lib/product-types"
import { calculateProductPricing } from "@/lib/product-pricing"
import { canDeleteInventoryItems } from "@/lib/inventory-permissions"
import { pickProductFields, validateProductInput } from "@/lib/product-input"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params
  const product = await prisma.product.findUnique({ where: { id } })

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  return NextResponse.json(product)
})

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
    }
    const inputError = validateProductInput(body)
    if (inputError) return NextResponse.json({ error: inputError }, { status: 400 })

    const current = await prisma.product.findUnique({
      where: { id },
      select: {
        code: true,
        itemType: true,
        family: true,
        baseUnitCost: true,
        vatPercentage: true,
        purchaseVatPercentage: true,
        salesVatPercentage: true,
        pricingMethod: true,
        targetMarginPercentage: true,
        fixedRetailPriceIncludingVat: true,
        appliedRetailPriceIncludingVat: true,
      },
    })
    if (!current) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (body.code !== undefined && body.code !== current.code) {
      return NextResponse.json({ error: "El código de producto es inmutable" }, { status: 400 })
    }
    if (body.itemType !== undefined && body.itemType !== current.itemType) {
      return NextResponse.json({ error: "El tipo de artículo es inmutable" }, { status: 400 })
    }
    if (body.family !== undefined && body.family !== current.family) {
      return NextResponse.json({ error: "La familia es inmutable porque forma parte del código" }, { status: 400 })
    }

    const productData = pickProductFields(body)
    const behavior = getProductTypeBehavior(current.itemType)
    if (behavior) Object.assign(productData, behavior)
    const pricing = calculateProductPricing({
      costSinVat: Object.prototype.hasOwnProperty.call(body, "baseUnitCost") ? body.baseUnitCost : current.baseUnitCost,
      purchaseVatPercentage: Object.prototype.hasOwnProperty.call(body, "purchaseVatPercentage") ? body.purchaseVatPercentage : current.purchaseVatPercentage,
      salesVatPercentage: Object.prototype.hasOwnProperty.call(body, "salesVatPercentage") ? body.salesVatPercentage : current.salesVatPercentage,
      vatPercentage: Object.prototype.hasOwnProperty.call(body, "vatPercentage") ? body.vatPercentage : current.vatPercentage,
      pricingMethod: Object.prototype.hasOwnProperty.call(body, "pricingMethod") ? body.pricingMethod : current.pricingMethod,
      targetMarginPercentage: Object.prototype.hasOwnProperty.call(body, "targetMarginPercentage") ? body.targetMarginPercentage : current.targetMarginPercentage,
      retailPriceIncludingVat: Object.prototype.hasOwnProperty.call(body, "appliedRetailPriceIncludingVat") ? body.appliedRetailPriceIncludingVat : current.appliedRetailPriceIncludingVat ?? current.fixedRetailPriceIncludingVat,
    })
    Object.assign(productData, {
      purchaseVatPercentage: pricing.purchaseVatPercentage,
      salesVatPercentage: pricing.salesVatPercentage,
      vatPercentage: pricing.vatPercentage,
      costIncludingVat: pricing.costIncludingVat,
      targetRetailPriceIncludingVat: pricing.targetRetailPriceIncludingVat,
      fixedRetailPriceIncludingVat: pricing.fixedRetailPriceIncludingVat,
      appliedRetailPriceIncludingVat: pricing.appliedRetailPriceIncludingVat,
      appliedRetailPriceExcludingVat: pricing.retailPriceExcludingVat,
      profitPerUnit: pricing.profitPerUnit,
      actualMarginPercentage: pricing.actualMarginPercentage,
      percentagePointDeviation: pricing.percentagePointDeviation,
      unitDifference: pricing.unitDifference,
      pricingDiagnosis: pricing.pricingDiagnosis,
    })

    const product = await prisma.product.update({
      where: { id },
      data: productData,
    })

    return NextResponse.json(product)
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
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
