import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import {
  findPotentialProductDuplicates,
  getNextProductCode,
  ProductCodeError,
} from "@/lib/product-code"
import { getProductTypeBehavior } from "@/lib/product-types"
import { calculateProductPricing } from "@/lib/product-pricing"
import { pickProductFields, validateProductInput } from "@/lib/product-input"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
import { getFirstSearchParam } from "@/lib/request-params"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const type = getFirstSearchParam(searchParams, "itemType", "tipo") || ""
  const family = getFirstSearchParam(searchParams, "family", "familia") || ""
  const section = getFirstSearchParam(searchParams, "section", "seccion") || ""
  const status = getFirstSearchParam(searchParams, "status", "estado") || ""
  const abcClass = getFirstSearchParam(searchParams, "abcClass", "claseAbc") || ""
  const requestedPage = Number(searchParams.get("page") || "1")
  const requestedPageSize = Number(searchParams.get("pageSize") || "50")
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 50

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { posDescription: { contains: search, mode: "insensitive" } },
      { fullDescription: { contains: search, mode: "insensitive" } },
    ]
  }
  if (type) where.itemType = type
  if (family) where.family = family
  if (section) where.section = section
  if (status) where.status = status
  if (abcClass) where.abcClass = abcClass
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        suppliers: {
          where: { isPrimary: true },
          include: { supplier: { select: { id: true, legalName: true } } },
          take: 1,
        },
      },
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({ products, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Datos no válidos" }, { status: 400 })
    }
    const inputError = validateProductInput(body)
    if (inputError) return NextResponse.json({ error: inputError }, { status: 400 })
    const itemType = String(body.itemType || "").trim().toUpperCase()
    const behavior = getProductTypeBehavior(itemType)
    if (!behavior) {
      return NextResponse.json({ error: "Tipo de artículo no soportado" }, { status: 400 })
    }

    const duplicados = await findPotentialProductDuplicates(prisma, {
      posDescription: body.posDescription,
      fullDescription: body.fullDescription,
      eanBarcode: body.eanBarcode,
    })

    const confirmDuplicate = body.confirmDuplicate ?? body.confirmDuplicado
    if (duplicados.length > 0 && confirmDuplicate !== true) {
      return NextResponse.json(
        {
          error: "Hay productos que podrían ser duplicados. Revísalos antes de continuar.",
          duplicados,
        },
        { status: 409 },
      )
    }

    const productData = pickProductFields(body)
    const pricing = calculateProductPricing({
      costSinVat: body.baseUnitCost,
      purchaseVatPercentage: body.purchaseVatPercentage,
      salesVatPercentage: body.salesVatPercentage,
      vatPercentage: body.vatPercentage,
      pricingMethod: body.pricingMethod,
      targetMarginPercentage: body.targetMarginPercentage,
      retailPriceIncludingVat: body.appliedRetailPriceIncludingVat,
    })
    Object.assign(productData, {
      itemType,
      ...behavior,
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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const code = await getNextProductCode(
          prisma,
          itemType,
          String(body.family || ""),
        )
        const product = await prisma.product.create({
          data: {
            ...(productData as Prisma.ProductUncheckedCreateInput),
            code,
            createdById: session.user.id,
          },
        })

        return NextResponse.json(product, { status: 201 })
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 2) {
          throw error
        }
      }
    }

    return NextResponse.json({ error: "No se pudo reservar un código" }, { status: 409 })
  } catch (error) {
    if (error instanceof ProductCodeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "No se pudo reservar un código único" }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Error al crear el producto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
