import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"
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

const catalogCreateSchema = z.object({
  type: catalogType,
  value: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  codePrefix: z.string().trim().max(3).nullable().optional(),
}).strict()

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const type = getFirstSearchParam(searchParams, "type", "tipo")

  const where: Record<string, unknown> = { active: true }
  if (type) where.type = type

  const catalogs = await prisma.catalog.findMany({
    where,
    orderBy: { value: "asc" },
  })

  return NextResponse.json(catalogs)
})

export const POST = withAuth(async (req, session) => {
  if (!hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const input = catalogCreateSchema.parse(await req.json())
    const type = input.type
    const value = input.value

    const data: { type: typeof type; value: string; description?: string | null; codePrefix?: string | null } = {
      type,
      value,
      description: input.description ?? null,
      codePrefix: input.codePrefix ?? null,
    }
    if (type === "FAMILIA") {
      const codePrefix = typeof input.codePrefix === "string"
        ? input.codePrefix.toUpperCase()
        : ""
      if (!/^[A-Z]{3}$/.test(codePrefix)) {
        return NextResponse.json({ error: "El prefijo de familia debe tener 3 letras mayúsculas" }, { status: 400 })
      }
      data.codePrefix = codePrefix
    } else if (input.codePrefix !== undefined && input.codePrefix !== null) {
      return NextResponse.json({ error: "El prefijo solo aplica a familias" }, { status: 400 })
    }

    const existing = await prisma.catalog.findUnique({
      where: { type_value: { type, value } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe el valor "${value}" en el catálogo "${type}"` },
        { status: 400 }
      )
    }

    const catalog = await prisma.catalog.create({ data })
    return NextResponse.json(catalog, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe ese prefijo de familia" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al crear el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
