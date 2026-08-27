import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requirePaymentFunction } from "@/lib/pagos"
import { paymentErrorResponse } from "@/lib/pagos-http"

const categorySchema = z.object({ codigo: z.string().trim().min(2).max(12), nombre: z.string().trim().min(2).max(80), descripcion: z.string().trim().max(200).optional() })

export const GET = withAuth(async (_req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "SOLICITAR", undefined, session.user.role)
    return NextResponse.json(await prisma.categoriaGasto.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }))
  } catch (error) {
    return paymentErrorResponse(error)
  }
})

export const POST = withAuth(async (req, session) => {
  try {
    await requirePaymentFunction(session.user.id, "ADMINISTRAR", undefined, session.user.role)
    const input = categorySchema.parse(await req.json())
    const category = await prisma.categoriaGasto.create({ data: { ...input, descripcion: input.descripcion || null } })
    await auditPaymentEvent(prisma, { actorId: session.user.id, accion: "CATEGORIA_GASTO_CREADA", tipoRegistro: "CategoriaGasto", registroId: category.id, despues: input })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    return paymentErrorResponse(error)
  }
})
