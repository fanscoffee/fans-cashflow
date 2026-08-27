import type { PrismaClient } from "@/generated/prisma/client"
import { getProductTypeBehavior } from "@/lib/product-types"

const PRODUCT_CODE_PATTERN = /^([A-Z]{2})-([A-Z]{3})-(\d{3})$/
const MAX_CORRELATIVE = 999

type ProductCodeDatabase = {
  catalogo: Pick<PrismaClient["catalogo"], "findFirst">
  producto: Pick<PrismaClient["producto"], "findMany">
}

export type ProductDuplicate = {
  id: string
  codigo: string
  codBarrasEan: string | null
  descripcionTpv: string
  descripcionCompleta: string
  tipoArticulo: string
  familia: string
  estado: string
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

function validateTipo(tipo: string) {
  const value = cleanText(tipo).toUpperCase()
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
  tipo: string,
  familia: string,
) {
  const tipoValue = validateTipo(tipo)
  const familiaValue = cleanText(familia)
  if (!familiaValue) throw new ProductCodeError("La familia es obligatoria")

  const [tipoCatalogo, familiaCatalogo] = await Promise.all([
    db.catalogo.findFirst({
      where: { tipo: "TIPO_ARTICULO", valor: tipoValue, activo: true },
      select: { valor: true },
    }),
    db.catalogo.findFirst({
      where: { tipo: "FAMILIA", valor: familiaValue, activo: true },
      select: { valor: true, prefijoCodigo: true },
    }),
  ])

  if (!tipoCatalogo) throw new ProductCodeError("Tipo de artículo no válido o inactivo")
  if (!familiaCatalogo) throw new ProductCodeError("Familia no válida o inactiva")

  const prefijo = validatePrefix(familiaCatalogo.prefijoCodigo)
  if (tipoValue === "SE" && prefijo !== "SEM") {
    throw new ProductCodeError("Los semielaborados solo pueden usar familia SEM")
  }

  const base = `${tipoValue}-${prefijo}`
  const productos = await db.producto.findMany({
    where: { codigo: { startsWith: `${base}-` } },
    select: { codigo: true },
  })

  let highest = 0
  for (const producto of productos) {
    const match = PRODUCT_CODE_PATTERN.exec(producto.codigo)
    if (!match || match[1] !== tipoValue || match[2] !== prefijo) continue
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
    descripcionTpv?: unknown
    descripcionCompleta?: unknown
    codBarrasEan?: unknown
    excludeId?: string
  },
) {
  const descripcionTpv = cleanText(input.descripcionTpv)
  const descripcionCompleta = cleanText(input.descripcionCompleta)
  const codBarrasEan = cleanText(input.codBarrasEan)
  const conditions = [
    ...(descripcionTpv.length >= 3
      ? [{ descripcionTpv: { contains: descripcionTpv, mode: "insensitive" as const } }]
      : []),
    ...(descripcionCompleta.length >= 3
      ? [{ descripcionCompleta: { contains: descripcionCompleta, mode: "insensitive" as const } }]
      : []),
    ...(codBarrasEan.length >= 3 ? [{ codBarrasEan }] : []),
  ]

  if (conditions.length === 0) return [] as ProductDuplicate[]

  return db.producto.findMany({
    where: {
      OR: conditions,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
      codigo: true,
      codBarrasEan: true,
      descripcionTpv: true,
      descripcionCompleta: true,
      tipoArticulo: true,
      familia: true,
      estado: true,
    },
    orderBy: { codigo: "asc" },
    take: 10,
  })
}
