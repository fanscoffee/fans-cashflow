import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import { getFirstSearchParam } from "@/lib/request-params"

const catalogType = z.enum([
  "TIPO_ARTICULO",
  "SECCION",
  "FAMILIA",
  "SUBFAMILIA",
  "UNIDAD_MEDIDA",
  "SI_NO",
  "VALORACION",
  "METODO_PRECIO",
  "CLASE_ABC",
  "UBICACION",
  "CONSERVACION",
  "ESTADO",
  "CODIGO_IVA",
  "ALERGENO",
  "PROVEEDOR",
])

const catalogUpdateSchema = z.object({
  type: catalogType.optional(),
  value: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  codePrefix: z.string().trim().max(3).nullable().optional(),
  active: z.boolean().optional(),
}).strict()

const PRODUCT_CATALOG_FIELDS: Record<string, string[]> = {
  TIPO_ARTICULO: ["itemType"],
  FAMILIA: ["family"],
  SUBFAMILIA: ["subfamily"],
  SECCION: ["section"],
  UNIDAD_MEDIDA: ["baseStockUnit", "purchaseUnit", "salesUnit"],
  SI_NO: ["stockControl", "batchControl"],
  VALORACION: ["valuationMethod"],
  METODO_PRECIO: ["pricingMethod"],
  CLASE_ABC: ["abcClass"],
  UBICACION: ["location"],
  CONSERVACION: ["storageConditions"],
  ESTADO: ["status"],
  CODIGO_IVA: ["vatCode"],
}

function getProductCatalogConditions(type: string, value: string): Record<string, unknown>[] {
  if (type === "ALERGENO") {
    // Allergens are stored as a semicolon-separated list.
    return [
      { allergens: value },
      { allergens: { startsWith: `${value};` } },
      { allergens: { startsWith: `${value}; ` } },
      { allergens: { endsWith: `;${value}` } },
      { allergens: { endsWith: `; ${value}` } },
      { allergens: { contains: `;${value};` } },
      { allergens: { contains: `; ${value};` } },
    ]
  }

  return (PRODUCT_CATALOG_FIELDS[type] || []).map((field) => ({ [field]: value }))
}

export const PATCH = withAuth(async (req, session, context) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()
    const input = catalogUpdateSchema.parse(body)
    const current = await prisma.catalog.findUnique({
      where: { id },
      select: { type: true, value: true, codePrefix: true },
    })
    if (!current) {
      return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 })
    }
    if (input.type !== undefined && input.type !== current.type) {
      return NextResponse.json({ error: "El tipo de catálogo es inmutable" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (input.type !== undefined) data.type = current.type
    if (input.value !== undefined) data.value = input.value
    if (input.description !== undefined) data.description = input.description
    if (input.active !== undefined) data.active = input.active
    if (input.codePrefix !== undefined) {
      if (current.type !== "FAMILIA") {
        return NextResponse.json({ error: "El prefijo solo aplica a familias" }, { status: 400 })
      }
      const codePrefix = typeof input.codePrefix === "string"
        ? input.codePrefix.toUpperCase()
        : ""
      if (!/^[A-Z]{3}$/.test(codePrefix)) {
        return NextResponse.json({ error: "El prefijo de familia debe tener 3 letras mayúsculas" }, { status: 400 })
      }
      if (codePrefix !== current.codePrefix) {
        const assignedProducts = await prisma.product.count({ where: { family: current.value } })
        if (assignedProducts > 0) {
          return NextResponse.json({ error: "No se puede cambiar el prefijo de una familia con productos" }, { status: 409 })
        }
      }
      data.codePrefix = codePrefix
    }

    if (input.value) {
      const existing = await prisma.catalog.findFirst({
        where: {
          type: current.type,
          value: input.value,
          id: { not: id },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: `Ya existe ese valor en el catálogo` },
          { status: 400 }
        )
      }
    }

    const catalog = await prisma.catalog.update({
      where: { id },
      data,
    })

    return NextResponse.json(catalog)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe ese prefijo de familia" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al actualizar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN)) {
    return NextResponse.json({ error: "Solo los administradores pueden eliminar catálogos" }, { status: 403 })
  }

  const { id } = await context.params
  const searchParams = new URL(req.url).searchParams
  const permanently = getFirstSearchParam(searchParams, "permanent", "permanente") === "true"

  try {
    if (permanently) {
      const catalog = await prisma.catalog.findUnique({
        where: { id },
        select: { type: true, value: true },
      })

      if (!catalog) {
        return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 })
      }

      const productConditions = getProductCatalogConditions(catalog.type, catalog.value)
      const assignedProducts = productConditions.length
        ? await prisma.product.count({ where: { OR: productConditions } })
        : 0
      if (assignedProducts > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${assignedProducts} producto(s) usan el valor "${catalog.value}". Reasígnalos antes de eliminarlo.` },
          { status: 409 }
        )
      }

      await prisma.catalog.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    await prisma.catalog.update({
      where: { id },
      data: { active: false },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al desactivar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
