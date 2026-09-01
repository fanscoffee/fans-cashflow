import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

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
  tipo: catalogType,
  valor: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  prefijoCodigo: z.string().trim().max(3).nullable().optional(),
}).strict()

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo")

  const where: Record<string, unknown> = { activo: true }
  if (tipo) where.tipo = tipo

  const catalogos = await prisma.catalogo.findMany({
    where,
    orderBy: { valor: "asc" },
  })

  return NextResponse.json(catalogos)
})

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const input = catalogCreateSchema.parse(await req.json())
    const tipo = input.tipo
    const valor = input.valor

    const data: { tipo: typeof tipo; valor: string; descripcion?: string | null; prefijoCodigo?: string | null } = {
      tipo,
      valor,
      descripcion: input.descripcion ?? null,
      prefijoCodigo: input.prefijoCodigo ?? null,
    }
    if (tipo === "FAMILIA") {
      const prefijoCodigo = typeof input.prefijoCodigo === "string"
        ? input.prefijoCodigo.toUpperCase()
        : ""
      if (!/^[A-Z]{3}$/.test(prefijoCodigo)) {
        return NextResponse.json({ error: "El prefijo de familia debe tener 3 letras mayúsculas" }, { status: 400 })
      }
      data.prefijoCodigo = prefijoCodigo
    } else if (input.prefijoCodigo !== undefined && input.prefijoCodigo !== null) {
      return NextResponse.json({ error: "El prefijo solo aplica a familias" }, { status: 400 })
    }

    const existing = await prisma.catalogo.findUnique({
      where: { tipo_valor: { tipo, valor } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe el valor "${valor}" en el catálogo "${tipo}"` },
        { status: 400 }
      )
    }

    const catalogo = await prisma.catalogo.create({ data })
    return NextResponse.json(catalogo, { status: 201 })
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
