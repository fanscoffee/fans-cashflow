import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN } from "@/lib/money"
import { calculateFondoFinal } from "@/lib/fondo"

const updateShiftSchema = z.object({
  efectivo: z.number().min(0).optional(),
  caixa: z.number().min(0).optional(),
  santander: z.number().min(0).optional(),
  fondoInicial: z.number().min(0).optional(),
  status: z.enum(["ABIERTO", "CERRADO"]).optional(),
  sinInformacion: z.boolean().optional().default(false),
})

const moneyInput = z
  .union([z.string(), z.number()])
  .refine((value) => String(value).trim() !== "", "El importe es obligatorio")
  .transform((value) => Number(String(value).replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0, "Importe no válido")

const signedMoneyInput = z
  .union([z.string(), z.number()])
  .refine((value) => String(value).trim() !== "", "El importe es obligatorio")
  .transform((value) => Number(String(value).replace(",", ".")))
  .refine((value) => Number.isFinite(value), "Importe no válido")

const cierreTurnoSchema = z.object({
  numeroCierreCaja: z.string().trim().min(1, "El número de cierre es obligatorio"),
  tpv: z.string().trim().min(1, "El TPV es obligatorio"),
  fechaHoraApertura: z.string().min(1, "La apertura del ticket es obligatoria"),
  fechaHoraCierre: z.string().min(1, "El cierre del ticket es obligatorio"),
  fondoCajaAnterior: moneyInput,
  cobrosEfectivo: moneyInput,
  reembolsosEfectivo: moneyInput,
  depositado: moneyInput,
  pagosSalidas: moneyInput,
  efectivoTeoricoCaja: moneyInput,
  cantidadEfectivoReal: moneyInput,
  descuadre: signedMoneyInput,
  ventasBrutas: moneyInput,
  reembolsos: moneyInput,
  descuentos: moneyInput,
  ventasNetas: moneyInput,
  ventasEfectivo: moneyInput,
  ventasTarjeta: moneyInput,
  ivaPan4Base: moneyInput,
  ivaPan4Cuota: moneyInput,
  iva10Base: moneyInput,
  iva10Cuota: moneyInput,
  observacionDescuadre: z.string().optional().default(""),
  efectivo: moneyInput,
  caixa: moneyInput,
  santander: moneyInput,
  sinFoto: z.boolean().optional().default(false),
})

function sameCalendarDate(value: string, shiftDate: Date) {
  return value.slice(0, 10) === shiftDate.toISOString().slice(0, 10)
}

function hasPaymentDifference(cierre: z.infer<typeof cierreTurnoSchema>) {
  return (
    Math.abs(cierre.efectivo - cierre.ventasEfectivo) > 0.009 ||
    Math.abs(cierre.caixa + cierre.santander - cierre.ventasTarjeta) > 0.009 ||
    Math.abs(cierre.descuadre) > 0.009
  )
}

export const PATCH = withAuth(async (req, session, context) => {
  const { shiftId } = await context.params

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

  const body = await req.json()
  const parsedData = updateShiftSchema.safeParse(body)
  if (!parsedData.success) {
    return NextResponse.json({ error: parsedData.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
  }
  const data = parsedData.data

  if (data.sinInformacion && data.status !== "CERRADO") {
    return NextResponse.json({ error: "El cierre sin información debe cerrar el turno" }, { status: 400 })
  }

  if (data.status === "ABIERTO" && session.user.role !== "SOCIO") {
    return NextResponse.json(
      { error: "Solo los socios pueden reabrir un turno" },
      { status: 403 }
    )
  }

  let cierre: z.infer<typeof cierreTurnoSchema> | null = null
  if (data.status === "CERRADO" && !data.sinInformacion) {
    if (!body.cierre) {
      return NextResponse.json(
        { error: "El cierre de caja confirmado es obligatorio para cerrar el turno" },
        { status: 400 }
      )
    }

    const parsedCierre = cierreTurnoSchema.safeParse(body.cierre)
    if (!parsedCierre.success) {
      return NextResponse.json({ error: parsedCierre.error.issues[0]?.message || "Datos del ticket no válidos" }, { status: 400 })
    }
    cierre = parsedCierre.data
    const currentCierre = await prisma.cierreTurno.findUnique({ where: { shiftId } })
    if (!currentCierre) {
      if (!sameCalendarDate(cierre.fechaHoraApertura, shift.date) || !sameCalendarDate(cierre.fechaHoraCierre, shift.date)) {
        return NextResponse.json(
          { error: "La fecha del ticket no coincide con la fecha del turno" },
          { status: 400 }
        )
      }

      const apertura = new Date(cierre.fechaHoraApertura).getTime()
      const cierreFecha = new Date(cierre.fechaHoraCierre).getTime()
      const tolerancia = 15 * 60 * 1000
      if (!Number.isFinite(apertura) || !Number.isFinite(cierreFecha) || cierreFecha < apertura || apertura < shift.createdAt.getTime() - tolerancia || cierreFecha > Date.now() + tolerancia) {
        return NextResponse.json(
          { error: "La fecha y hora del ticket están fuera del intervalo del turno" },
          { status: 400 }
        )
      }
    }

    if (hasPaymentDifference(cierre) && !cierre.observacionDescuadre.trim()) {
      return NextResponse.json(
        { error: "Debes indicar una observación para guardar el descuadre" },
        { status: 400 }
      )
    }

    const duplicate = await prisma.cierreTurno.findFirst({
      where: {
        tpv: cierre.tpv,
        numeroCierreCaja: cierre.numeroCierreCaja,
        ...(currentCierre ? { NOT: { id: currentCierre.id } } : {}),
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: "Ya existe un cierre con ese número en ese TPV" },
        { status: 400 }
      )
    }
  }

  const [expensesAgg, currentExpensesAgg] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { importe: true },
      where: { shiftId },
    }),
    prisma.gastoCorriente.aggregate({
      _sum: { importe: true },
      where: { shiftId, estado: { not: "ANULADO" } },
    }),
  ])
  const newFondoInicial = data.fondoInicial !== undefined ? data.fondoInicial : toN(shift.fondoInicial)
  const fondoFinal = calculateFondoFinal(
    newFondoInicial,
    [{ importe: expensesAgg._sum.importe }],
    [{ importe: currentExpensesAgg._sum.importe }],
  )

  const updated = await prisma.$transaction(async (tx) => {
    const updatedShift = await tx.shift.update({
      where: { id: shiftId },
      data: {
        ...(cierre ? { efectivo: cierre.efectivo, caixa: cierre.caixa, santander: cierre.santander } : {}),
        ...(data.efectivo !== undefined && !cierre && { efectivo: data.efectivo }),
        ...(data.caixa !== undefined && !cierre && { caixa: data.caixa }),
        ...(data.santander !== undefined && !cierre && { santander: data.santander }),
        ...(data.fondoInicial !== undefined && { fondoInicial: data.fondoInicial }),
        ...(data.status && { status: data.status }),
        ...(data.status === "CERRADO" && { closedAt: new Date() }),
        ...(data.status === "ABIERTO" && { closedAt: null }),
        fondoFinal,
      },
      include: { expenses: true, cierreTurno: true },
    })

    if (cierre) {
      await tx.cierreTurno.upsert({
        where: { shiftId },
        create: {
          shiftId,
          numeroCierreCaja: cierre.numeroCierreCaja,
          tpv: cierre.tpv,
          fechaHoraApertura: new Date(cierre.fechaHoraApertura),
          fechaHoraCierre: new Date(cierre.fechaHoraCierre),
          fondoCajaAnterior: cierre.fondoCajaAnterior,
          cobrosEfectivo: cierre.cobrosEfectivo,
          reembolsosEfectivo: cierre.reembolsosEfectivo,
          depositado: cierre.depositado,
          pagosSalidas: cierre.pagosSalidas,
          efectivoTeoricoCaja: cierre.efectivoTeoricoCaja,
          cantidadEfectivoReal: cierre.cantidadEfectivoReal,
          descuadre: cierre.descuadre,
          ventasBrutas: cierre.ventasBrutas,
          reembolsos: cierre.reembolsos,
          descuentos: cierre.descuentos,
          ventasNetas: cierre.ventasNetas,
          ventasEfectivo: cierre.ventasEfectivo,
          ventasTarjeta: cierre.ventasTarjeta,
          ivaPan4Base: cierre.ivaPan4Base,
          ivaPan4Cuota: cierre.ivaPan4Cuota,
          iva10Base: cierre.iva10Base,
          iva10Cuota: cierre.iva10Cuota,
          observacionDescuadre: cierre.observacionDescuadre.trim() || null,
          confirmadoPorId: session.user.id,
        },
        update: {
          numeroCierreCaja: cierre.numeroCierreCaja,
          tpv: cierre.tpv,
          fechaHoraApertura: new Date(cierre.fechaHoraApertura),
          fechaHoraCierre: new Date(cierre.fechaHoraCierre),
          fondoCajaAnterior: cierre.fondoCajaAnterior,
          cobrosEfectivo: cierre.cobrosEfectivo,
          reembolsosEfectivo: cierre.reembolsosEfectivo,
          depositado: cierre.depositado,
          pagosSalidas: cierre.pagosSalidas,
          efectivoTeoricoCaja: cierre.efectivoTeoricoCaja,
          cantidadEfectivoReal: cierre.cantidadEfectivoReal,
          descuadre: cierre.descuadre,
          ventasBrutas: cierre.ventasBrutas,
          reembolsos: cierre.reembolsos,
          descuentos: cierre.descuentos,
          ventasNetas: cierre.ventasNetas,
          ventasEfectivo: cierre.ventasEfectivo,
          ventasTarjeta: cierre.ventasTarjeta,
          ivaPan4Base: cierre.ivaPan4Base,
          ivaPan4Cuota: cierre.ivaPan4Cuota,
          iva10Base: cierre.iva10Base,
          iva10Cuota: cierre.iva10Cuota,
          observacionDescuadre: cierre.observacionDescuadre.trim() || null,
          confirmadoPorId: session.user.id,
          confirmadoAt: new Date(),
        },
      })
    }

    return updatedShift
  })

  return NextResponse.json(updated)
})
