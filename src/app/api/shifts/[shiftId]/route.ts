import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const updateShiftSchema = z.object({
  efectivo: z.number().min(0).optional(),
  caixa: z.number().min(0).optional(),
  santander: z.number().min(0).optional(),
  fondoInicial: z.number().optional(),
  fondoFinal: z.number().optional(),
  status: z.enum(["ABIERTO", "CERRADO"]).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { shiftId } = await params

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const isAdminOrSocio = session.user.role === "ADMIN" || session.user.role === "SOCIO"
  if (!isAdminOrSocio && shift.createdById !== session.user.id) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  if (!isAdminOrSocio && shift.status === "CERRADO") {
    return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 400 })
  }

  const body = await request.json()
  const data = updateShiftSchema.parse(body)

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...(data.efectivo !== undefined && { efectivo: data.efectivo }),
      ...(data.caixa !== undefined && { caixa: data.caixa }),
      ...(data.santander !== undefined && { santander: data.santander }),
      ...(data.fondoInicial !== undefined && { fondoInicial: data.fondoInicial }),
      ...(data.fondoFinal !== undefined && { fondoFinal: data.fondoFinal }),
      ...(data.status && { status: data.status }),
    },
    include: { expenses: true },
  })

  return NextResponse.json(updated)
}
