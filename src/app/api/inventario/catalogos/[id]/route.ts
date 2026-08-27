import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

const PRODUCTO_CATALOGO_FIELDS: Record<string, string[]> = {
  TIPO_ARTICULO: ["tipoArticulo"],
  FAMILIA: ["familia"],
  SUBFAMILIA: ["subfamilia"],
  SECCION: ["seccion"],
  UNIDAD_MEDIDA: ["umBaseStock", "umCompra", "umVenta"],
  SI_NO: ["controlaStock", "controlLote"],
  VALORACION: ["metodoValoracion"],
  METODO_PRECIO: ["metodoPrecio"],
  CLASE_ABC: ["claseAbc"],
  UBICACION: ["ubicacion"],
  CONSERVACION: ["conservacion"],
  ESTADO: ["estado"],
  CODIGO_IVA: ["codIva"],
}

function getProductoCatalogoConditions(tipo: string, valor: string): Record<string, unknown>[] {
  if (tipo === "ALERGENO") {
    // Los alérgenos se almacenan como una lista separada por punto y coma.
    return [
      { alergenos: valor },
      { alergenos: { startsWith: `${valor};` } },
      { alergenos: { startsWith: `${valor}; ` } },
      { alergenos: { endsWith: `;${valor}` } },
      { alergenos: { endsWith: `; ${valor}` } },
      { alergenos: { contains: `;${valor};` } },
      { alergenos: { contains: `; ${valor};` } },
    ]
  }

  return (PRODUCTO_CATALOGO_FIELDS[tipo] || []).map((field) => ({ [field]: valor }))
}

export const PATCH = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "SOCIO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const body = await req.json()
    const current = await prisma.catalogo.findUnique({
      where: { id },
      select: { tipo: true, valor: true, prefijoCodigo: true },
    })
    if (!current) {
      return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 })
    }

    const data = { ...body }
    if (body.prefijoCodigo !== undefined) {
      if (current.tipo !== "FAMILIA") {
        return NextResponse.json({ error: "El prefijo solo aplica a familias" }, { status: 400 })
      }
      const prefijoCodigo = typeof body.prefijoCodigo === "string"
        ? body.prefijoCodigo.trim().toUpperCase()
        : ""
      if (!/^[A-Z]{3}$/.test(prefijoCodigo)) {
        return NextResponse.json({ error: "El prefijo de familia debe tener 3 letras mayúsculas" }, { status: 400 })
      }
      if (prefijoCodigo !== current.prefijoCodigo) {
        const productosAsignados = await prisma.producto.count({ where: { familia: current.valor } })
        if (productosAsignados > 0) {
          return NextResponse.json({ error: "No se puede cambiar el prefijo de una familia con productos" }, { status: 409 })
        }
      }
      data.prefijoCodigo = prefijoCodigo
    }

    if (body.valor) {
      const existing = await prisma.catalogo.findFirst({
        where: {
          tipo: body.tipo || undefined,
          valor: body.valor,
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

    const catalogo = await prisma.catalogo.update({
      where: { id },
      data,
    })

    return NextResponse.json(catalogo)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe ese prefijo de familia" }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Error al actualizar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, session, context) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo los administradores pueden eliminar catálogos" }, { status: 403 })
  }

  const { id } = await context.params
  const permanently = new URL(req.url).searchParams.get("permanente") === "true"

  try {
    if (permanently) {
      const catalogo = await prisma.catalogo.findUnique({
        where: { id },
        select: { tipo: true, valor: true },
      })

      if (!catalogo) {
        return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404 })
      }

      const productoConditions = getProductoCatalogoConditions(catalogo.tipo, catalogo.valor)
      const productosAsignados = productoConditions.length
        ? await prisma.producto.count({ where: { OR: productoConditions } })
        : 0
      if (productosAsignados > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${productosAsignados} producto(s) usan el valor "${catalogo.valor}". Reasígnalos antes de eliminarlo.` },
          { status: 409 }
        )
      }

      await prisma.catalogo.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    await prisma.catalogo.update({
      where: { id },
      data: { activo: false },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al desactivar el catálogo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
