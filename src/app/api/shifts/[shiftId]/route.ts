import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { toN } from "@/lib/money"
import { calculateFundFinal } from "@/lib/fund"
import { CurrentExpenseStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"

const updateShiftSchema = z.object({
  cash: z.number().min(0).optional(),
  caixaBankAmount: z.number().min(0).optional(),
  santanderAmount: z.number().min(0).optional(),
  openingFund: z.number().min(0).optional(),
  status: z.enum(["ABIERTO", "CERRADO"]).optional(),
  noInformation: z.boolean().optional().default(false),
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

const shiftCloseSchema = z.object({
  cashCloseNumber: z.string().trim().min(1, "El número de cierre es obligatorio"),
  pos: z.string().trim().min(1, "El TPV es obligatorio"),
  openingDateTime: z.string().min(1, "La apertura del ticket es obligatoria"),
  closingDateTime: z.string().min(1, "El cierre del ticket es obligatorio"),
  previousCashFund: moneyInput,
  cashReceipts: moneyInput,
  cashRefunds: moneyInput,
  depositedAmount: moneyInput,
  paymentOutflows: moneyInput,
  theoreticalCash: moneyInput,
  actualCash: moneyInput,
  cashVariance: signedMoneyInput,
  grossSales: moneyInput,
  refunds: moneyInput,
  discounts: moneyInput,
  netSales: moneyInput,
  cashSales: moneyInput,
  cardSales: moneyInput,
  breadVat4Base: moneyInput,
  breadVat4Amount: moneyInput,
  vat10Base: moneyInput,
  vat10Amount: moneyInput,
  varianceNote: z.string().optional().default(""),
  cash: moneyInput,
  caixaBankAmount: moneyInput,
  santanderAmount: moneyInput,
  sinFoto: z.boolean().optional().default(false),
})

function sameCalendarDate(value: string, shiftDate: Date) {
  return value.slice(0, 10) === shiftDate.toISOString().slice(0, 10)
}

function hasPaymentDifference(close: z.infer<typeof shiftCloseSchema>) {
  return (
    Math.abs(close.cash - close.cashSales) > 0.009 ||
    Math.abs(close.caixaBankAmount + close.santanderAmount - close.cardSales) > 0.009 ||
    Math.abs(close.cashVariance) > 0.009
  )
}

export const PATCH = withAuth(async (req, session, context) => {
  if (isRole(session.user.role, UserRole.BAKERY)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { shiftId } = await context.params

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  const isAdminOrPartner = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  if (!isAdminOrPartner && shift.createdById !== session.user.id) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  }

  if (!isAdminOrPartner && shift.status === "CERRADO") {
    return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 400 })
  }

  const body = await req.json()
  const parsedData = updateShiftSchema.safeParse(body)
  if (!parsedData.success) {
    return NextResponse.json({ error: parsedData.error.issues[0]?.message || "Datos no válidos" }, { status: 400 })
  }
  const data = parsedData.data

  if (!isAdminOrPartner && data.openingFund !== undefined) {
    return NextResponse.json({ error: "El fondo inicial solo puede cambiarse desde una operación autorizada" }, { status: 403 })
  }

  if (data.noInformation && data.status !== "CERRADO") {
    return NextResponse.json({ error: "El cierre sin información debe cerrar el turno" }, { status: 400 })
  }

  if (data.status === "ABIERTO" && !isRole(session.user.role, UserRole.PARTNER)) {
    return NextResponse.json(
      { error: "Solo los socios pueden reabrir un turno" },
      { status: 403 }
    )
  }

  let close: z.infer<typeof shiftCloseSchema> | null = null
  if (data.status === "CERRADO" && !data.noInformation) {
    if (!body.close) {
      return NextResponse.json(
        { error: "El cierre de caja confirmado es obligatorio para cerrar el turno" },
        { status: 400 }
      )
    }

    const parsedClose = shiftCloseSchema.safeParse(body.close)
    if (!parsedClose.success) {
      return NextResponse.json({ error: parsedClose.error.issues[0]?.message || "Datos del ticket no válidos" }, { status: 400 })
    }
    close = parsedClose.data
    const currentClose = await prisma.shiftClose.findUnique({ where: { shiftId } })
    if (!currentClose) {
      if (!sameCalendarDate(close.openingDateTime, shift.date) || !sameCalendarDate(close.closingDateTime, shift.date)) {
        return NextResponse.json(
          { error: "La fecha del ticket no coincide con la fecha del turno" },
          { status: 400 }
        )
      }

      const apertura = new Date(close.openingDateTime).getTime()
      const closeDate = new Date(close.closingDateTime).getTime()
      const tolerance = 15 * 60 * 1000
      if (!Number.isFinite(apertura) || !Number.isFinite(closeDate) || closeDate < apertura || apertura < shift.createdAt.getTime() - tolerance || closeDate > Date.now() + tolerance) {
        return NextResponse.json(
          { error: "La fecha y hora del ticket están fuera del intervalo del turno" },
          { status: 400 }
        )
      }
    }

    if (hasPaymentDifference(close) && !close.varianceNote.trim()) {
      return NextResponse.json(
        { error: "Debes indicar una observación para guardar el descuadre" },
        { status: 400 }
      )
    }

    const duplicate = await prisma.shiftClose.findFirst({
      where: {
        pos: close.pos,
        cashCloseNumber: close.cashCloseNumber,
        ...(currentClose ? { NOT: { id: currentClose.id } } : {}),
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
      _sum: { amount: true },
      where: { shiftId },
    }),
    prisma.currentExpense.aggregate({
      _sum: { amount: true },
      where: { shiftId, status: { not: CurrentExpenseStatus.VOID } },
    }),
  ])
  const newFundInicial = data.openingFund !== undefined ? data.openingFund : toN(shift.openingFund)
  const closingFund = calculateFundFinal(
    newFundInicial,
    [{ amount: expensesAgg._sum.amount }],
    [{ amount: currentExpensesAgg._sum?.amount }],
  )

  const updated = await prisma.$transaction(async (tx) => {
    const updatedShift = await tx.shift.update({
      where: { id: shiftId },
      data: {
        ...(close ? { cash: close.cash, caixaBankAmount: close.caixaBankAmount, santanderAmount: close.santanderAmount } : {}),
        ...(data.cash !== undefined && !close && { cash: data.cash }),
        ...(data.caixaBankAmount !== undefined && !close && { caixaBankAmount: data.caixaBankAmount }),
        ...(data.santanderAmount !== undefined && !close && { santanderAmount: data.santanderAmount }),
        ...(data.openingFund !== undefined && { openingFund: data.openingFund }),
        ...(data.status && { status: data.status }),
        ...(data.status === "CERRADO" && { closedAt: new Date() }),
        ...(data.status === "ABIERTO" && { closedAt: null }),
        closingFund,
      },
      include: { expenses: true, shiftClose: true },
    })

    if (close) {
      await tx.shiftClose.upsert({
        where: { shiftId },
        create: {
          shiftId,
          cashCloseNumber: close.cashCloseNumber,
          pos: close.pos,
          openingDateTime: new Date(close.openingDateTime),
          closingDateTime: new Date(close.closingDateTime),
          previousCashFund: close.previousCashFund,
          cashReceipts: close.cashReceipts,
          cashRefunds: close.cashRefunds,
          depositedAmount: close.depositedAmount,
          paymentOutflows: close.paymentOutflows,
          theoreticalCash: close.theoreticalCash,
          actualCash: close.actualCash,
          cashVariance: close.cashVariance,
          grossSales: close.grossSales,
          refunds: close.refunds,
          discounts: close.discounts,
          netSales: close.netSales,
          cashSales: close.cashSales,
          cardSales: close.cardSales,
          breadVat4Base: close.breadVat4Base,
          breadVat4Amount: close.breadVat4Amount,
          vat10Base: close.vat10Base,
          vat10Amount: close.vat10Amount,
          varianceNote: close.varianceNote.trim() || null,
          confirmedById: session.user.id,
        },
        update: {
          cashCloseNumber: close.cashCloseNumber,
          pos: close.pos,
          openingDateTime: new Date(close.openingDateTime),
          closingDateTime: new Date(close.closingDateTime),
          previousCashFund: close.previousCashFund,
          cashReceipts: close.cashReceipts,
          cashRefunds: close.cashRefunds,
          depositedAmount: close.depositedAmount,
          paymentOutflows: close.paymentOutflows,
          theoreticalCash: close.theoreticalCash,
          actualCash: close.actualCash,
          cashVariance: close.cashVariance,
          grossSales: close.grossSales,
          refunds: close.refunds,
          discounts: close.discounts,
          netSales: close.netSales,
          cashSales: close.cashSales,
          cardSales: close.cardSales,
          breadVat4Base: close.breadVat4Base,
          breadVat4Amount: close.breadVat4Amount,
          vat10Base: close.vat10Base,
          vat10Amount: close.vat10Amount,
          varianceNote: close.varianceNote.trim() || null,
          confirmedById: session.user.id,
          confirmedAt: new Date(),
        },
      })
    }

    return updatedShift
  })

  return NextResponse.json(updated)
})
