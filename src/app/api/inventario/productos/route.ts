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

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const tipo = searchParams.get("tipo") || ""
  const familia = searchParams.get("familia") || ""
  const seccion = searchParams.get("seccion") || ""
  const estado = searchParams.get("estado") || ""
  const claseAbc = searchParams.get("claseAbc") || ""
  const esEjemplo = searchParams.get("esEjemplo")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { codigo: { contains: search, mode: "insensitive" } },
      { descripcionTpv: { contains: search, mode: "insensitive" } },
      { descripcionCompleta: { contains: search, mode: "insensitive" } },
    ]
  }
  if (tipo) where.tipoArticulo = tipo
  if (familia) where.familia = familia
  if (seccion) where.seccion = seccion
  if (estado) where.estado = estado
  if (claseAbc) where.claseAbc = claseAbc
  if (esEjemplo !== null) where.esEjemplo = esEjemplo === "true"

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { codigo: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        proveedores: {
          where: { esPrincipal: true },
          include: { proveedor: { select: { id: true, razonSocial: true } } },
          take: 1,
        },
      },
    }),
    prisma.producto.count({ where }),
  ])

  return NextResponse.json({ productos, total, page, pageSize })
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const tipoArticulo = String(body.tipoArticulo || "").trim().toUpperCase()
    const behavior = getProductTypeBehavior(tipoArticulo)
    if (!behavior) {
      return NextResponse.json({ error: "Tipo de artículo no soportado" }, { status: 400 })
    }

    const duplicados = await findPotentialProductDuplicates(prisma, {
      descripcionTpv: body.descripcionTpv,
      descripcionCompleta: body.descripcionCompleta,
      codBarrasEan: body.codBarrasEan,
    })

    if (duplicados.length > 0 && body.confirmarDuplicado !== true) {
      return NextResponse.json(
        {
          error: "Hay productos que podrían ser duplicados. Revísalos antes de continuar.",
          duplicados,
        },
        { status: 409 },
      )
    }

    const productData = { ...body }
    delete productData.confirmarDuplicado
    const pricing = calculateProductPricing({
      costeSinIva: body.costeUmBase,
      ivaCompraPct: body.ivaCompraPct,
      ivaVentaPct: body.ivaVentaPct,
      ivaPct: body.ivaPct,
      metodoPrecio: body.metodoPrecio,
      margenObjetivoPct: body.margenObjetivoPct,
      pvpVentaConIva: body.pvpAplicadoConIva,
    })
    Object.assign(productData, {
      tipoArticulo,
      ...behavior,
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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const codigo = await getNextProductCode(
          prisma,
          tipoArticulo,
          String(body.familia || ""),
        )
        const producto = await prisma.producto.create({
          data: {
            ...productData,
            codigo,
            createdById: session.user.id,
          },
        })

        return NextResponse.json(producto, { status: 201 })
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
