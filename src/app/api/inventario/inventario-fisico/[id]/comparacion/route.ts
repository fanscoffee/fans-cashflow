import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, _session, context) => {
  const { id } = await context.params

  const inventarioActual = await prisma.inventarioFisico.findUnique({
    where: { id },
    include: {
      lineas: {
        include: {
          producto: {
            select: {
              id: true,
              codigo: true,
              descripcionTpv: true,
              umCompra: true,
              umBaseStock: true,
              factorCompraABase: true,
            },
          },
        },
      },
    },
  })

  if (!inventarioActual) {
    return NextResponse.json(
      { error: "Inventario no encontrado" },
      { status: 404 }
    )
  }

  const inventarioAnterior = await prisma.inventarioFisico.findFirst({
    where: { fechaConteo: { lt: inventarioActual.fechaConteo } },
    orderBy: { fechaConteo: "desc" },
    include: {
      lineas: {
        select: {
          productoId: true,
          cantidadUm2: true,
        },
      },
    },
  })

  const mapaAnterior: Record<string, number> = {}
  if (inventarioAnterior) {
    for (const linea of inventarioAnterior.lineas) {
      mapaAnterior[linea.productoId] = Number(linea.cantidadUm2)
    }
  }

  const productoIds = inventarioActual.lineas.map((l) => l.producto.id)
  const recepciones = await prisma.recepcionLinea.findMany({
    where: {
      productoId: { in: productoIds },
      recepcion: {
        fechaRecepcion: {
          gt: inventarioAnterior?.fechaConteo || new Date(0),
          lte: inventarioActual.fechaConteo,
        },
      },
    },
    select: {
      productoId: true,
      cantidadRecibida: true,
      producto: {
        select: {
          factorCompraABase: true,
          umCompra: true,
          umBaseStock: true,
        },
      },
    },
  })

  const mapaRecibido: Record<string, number> = {}
  for (const r of recepciones) {
    const sameUnit = r.producto.umCompra === r.producto.umBaseStock
    const factor = Number(r.producto.factorCompraABase) || (sameUnit ? 1 : 0)
    mapaRecibido[r.productoId] = (mapaRecibido[r.productoId] || 0) + Number(r.cantidadRecibida) * factor
  }

  const comparacion = inventarioActual.lineas.map((linea) => {
    const anterior = mapaAnterior[linea.producto.id] || 0
    const recibido = mapaRecibido[linea.producto.id] || 0
    const actual = Number(linea.cantidadUm2)
    const diferencia = anterior + recibido - actual

    return {
      producto: linea.producto,
      cantidadUm1: Number(linea.cantidadUm1),
      cantidadUm2: Number(linea.cantidadUm2),
      unidadBase: linea.producto.umBaseStock,
      anterior,
      recibido,
      actual,
      diferencia,
    }
  })

  return NextResponse.json({
    inventario: {
      id: inventarioActual.id,
      fechaConteo: inventarioActual.fechaConteo,
      notas: inventarioActual.notas,
    },
    inventarioAnterior: inventarioAnterior
      ? {
          id: inventarioAnterior.id,
          fechaConteo: inventarioAnterior.fechaConteo,
        }
      : null,
    comparacion,
  })
})
