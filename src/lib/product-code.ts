import type { PrismaClient } from "@/generated/prisma/client"
import { getProductTypeBehavior } from "@/lib/product-types"

const PRODUCT_CODE_PATTERN = /^([A-Z]{2})-([A-Z]{3})-(\d{3})$/
const MAX_CORRELATIVE = 999

type ProductCodeDatabase = {
  catalog: Pick<PrismaClient["catalog"], "findFirst">
  product: Pick<PrismaClient["product"], "findMany">
}

export type ProductDuplicate = {
  id: string
  code: string
  eanBarcode: string | null
  posDescription: string
  fullDescription: string
  itemType: string
  family: string
  status: string
}

export class ProductCodeError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = "ProductCodeError"
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

function validateType(type: string) {
  const value = cleanText(type).toUpperCase()
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new ProductCodeError("El tipo de artículo debe tener 2 letras mayúsculas")
  }
  if (!getProductTypeBehavior(value)) {
    throw new ProductCodeError("Tipo de artículo no soportado")
  }
  return value
}

function validatePrefix(prefix: unknown) {
  const value = cleanText(prefix).toUpperCase()
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new ProductCodeError("La familia no tiene un prefijo de código válido")
  }
  return value
}

export async function getNextProductCode(
  db: ProductCodeDatabase,
  type: string,
  family: string,
) {
  const typeValue = validateType(type)
  const familyValue = cleanText(family)
  if (!familyValue) throw new ProductCodeError("La familia es obligatoria")

  const [typeCatalog, familyCatalog] = await Promise.all([
    db.catalog.findFirst({
      where: { type: "TIPO_ARTICULO", value: typeValue, active: true },
      select: { value: true },
    }),
    db.catalog.findFirst({
      where: { type: "FAMILIA", value: familyValue, active: true },
      select: { value: true, codePrefix: true },
    }),
  ])

  if (!typeCatalog) throw new ProductCodeError("Tipo de artículo no válido o inactivo")
  if (!familyCatalog) throw new ProductCodeError("Familia no válida o inactiva")

  const prefijo = validatePrefix(familyCatalog.codePrefix)
  if (typeValue === "SE" && prefijo !== "SEM") {
    throw new ProductCodeError("Los semielaborados solo pueden usar familia SEM")
  }

  const base = `${typeValue}-${prefijo}`
  const products = await db.product.findMany({
    where: { code: { startsWith: `${base}-` } },
    select: { code: true },
  })

  let highest = 0
  for (const product of products) {
    const match = PRODUCT_CODE_PATTERN.exec(product.code)
    if (!match || match[1] !== typeValue || match[2] !== prefijo) continue
    highest = Math.max(highest, Number(match[3]))
  }

  if (highest >= MAX_CORRELATIVE) {
    throw new ProductCodeError(`No quedan correlativos disponibles para ${base}`, 409)
  }

  return `${base}-${String(highest + 1).padStart(3, "0")}`
}

export async function findPotentialProductDuplicates(
  db: ProductCodeDatabase,
  input: {
    posDescription?: unknown
    fullDescription?: unknown
    eanBarcode?: unknown
    excludeId?: string
  },
) {
  const posDescription = cleanText(input.posDescription)
  const fullDescription = cleanText(input.fullDescription)
  const eanBarcode = cleanText(input.eanBarcode)
  const conditions = [
    ...(posDescription.length >= 3
      ? [{ posDescription: { contains: posDescription, mode: "insensitive" as const } }]
      : []),
    ...(fullDescription.length >= 3
      ? [{ fullDescription: { contains: fullDescription, mode: "insensitive" as const } }]
      : []),
    ...(eanBarcode.length >= 3 ? [{ eanBarcode }] : []),
  ]

  if (conditions.length === 0) return [] as ProductDuplicate[]

  return db.product.findMany({
    where: {
      OR: conditions,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
      code: true,
      eanBarcode: true,
      posDescription: true,
      fullDescription: true,
      itemType: true,
      family: true,
      status: true,
    },
    orderBy: { code: "asc" },
    take: 10,
  })
}
