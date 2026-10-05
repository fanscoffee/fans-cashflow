import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
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
  operationalReview: z.object({
    productionReviewed: z.literal(true),
    wasteReviewed: z.literal(true),
  }).strict().optional(),
})

class HistoricalShiftReopenError extends Error {}

const BUSINESS_TIME_ZONE = "Europe/Madrid"
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const businessOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  timeZoneName: "longOffset",
})

function businessOffsetMs(value: Date) {
  const offset = businessOffsetFormatter.formatToParts(value).find((part) => part.type === "timeZoneName")?.value
  if (!offset) return null
  if (offset === "GMT") return 0
  const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === "-" ? -1 : 1) * minutes * 60_000
}

function businessDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute] = match
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute
  ) return null

  const initialOffset = businessOffsetMs(wallClock)
  if (initialOffset == null) return null
  const firstCandidate = new Date(wallClock.getTime() - initialOffset)
  const actualOffset = businessOffsetMs(firstCandidate)
  if (actualOffset == null) return null
  return new Date(wallClock.getTime() - actualOffset)
}

const moneyInput = z
  .union([z.string(), z.number()])
  .refine((value) => String(value).trim() !== "", "El importe es obligatorio")
  .transform((value) => Number(String(value).replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0, "Importe no válido")

const shiftCloseSchema = z.object({
  cashCloseNumber: z.string().trim().min(1, "El número de cierre es obligatorio"),
  openingDateTime: z.string().min(1, "La apertura del ticket es obligatoria"),
  closingDateTime: z.string().min(1, "El cierre del ticket es obligatorio"),
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
  const shiftCalendarDate = businessDateFormatter.format(shiftDate)
  return value.slice(0, 10) === shiftCalendarDate
}

function hasPaymentDifference(close: z.infer<typeof shiftCloseSchema>) {
  return (
    Math.abs(close.cash - close.cashSales) > 0.009 ||
    Math.abs(close.caixaBankAmount + close.santanderAmount - close.cardSales) > 0.009
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

  if (data.status === "CERRADO" && !data.operationalReview) {
    return NextResponse.json(
      { error: "Debes revisar la producción y las mermas antes de cerrar el turno" },
      { status: 400 }
    )
  }

  if (data.status === "ABIERTO" && !isRole(session.user.role, UserRole.PARTNER)) {
    return NextResponse.json(
      { error: "Solo los socios pueden reabrir un turno" },
      { status: 403 }
    )
  }

  let close: z.infer<typeof shiftCloseSchema> | null = null
  let closeTimes: { opening: Date; closing: Date } | null = null
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
    const opening = businessDateTime(close.openingDateTime)
    const closing = businessDateTime(close.closingDateTime)
    if (!opening || !closing) {
      return NextResponse.json(
        { error: "La fecha y hora del ticket no son válidas" },
        { status: 400 },
      )
    }
    closeTimes = { opening, closing }
    const currentClose = await prisma.shiftClose.findUnique({ where: { shiftId } })
    if (!currentClose) {
      if (!sameCalendarDate(close.openingDateTime, shift.date) || !sameCalendarDate(close.closingDateTime, shift.date)) {
        return NextResponse.json(
          { error: "La fecha del ticket no coincide con la fecha del turno" },
          { status: 400 }
        )
      }

      const apertura = opening.getTime()
      const closeDate = closing.getTime()
      const tolerance = 15 * 60 * 1000
      if (closeDate < apertura || closeDate > Date.now() + tolerance) {
        return NextResponse.json(
          { error: "La fecha y hora del ticket no son válidas o el cierre está en el futuro" },
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

  }

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(6432101)`)

      const lockedShift = await tx.shift.findUnique({ where: { id: shiftId } })
      if (!lockedShift) throw new Error("Turno no encontrado durante la actualización")

      const [expensesAgg, currentExpensesAgg] = await Promise.all([
        tx.expense.aggregate({
          _sum: { amount: true },
          where: { shiftId },
        }),
        tx.currentExpense.aggregate({
          _sum: { amount: true },
          where: { shiftId, status: { not: CurrentExpenseStatus.VOID } },
        }),
      ])

      let openingFund = data.openingFund !== undefined ? data.openingFund : toN(lockedShift.openingFund)

      if (data.status === "ABIERTO" && lockedShift.status === "CERRADO" && lockedShift.closedAt) {
        const laterShift = await tx.shift.findFirst({
          where: { createdAt: { gt: lockedShift.createdAt } },
          select: { id: true },
        })

        if (laterShift) throw new HistoricalShiftReopenError()

        const additionsResult = await tx.fundAddition.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gt: lockedShift.closedAt } },
        })
        openingFund = Math.round((openingFund + toN(additionsResult._sum.amount)) * 100) / 100
      }

      const closingFund = calculateFundFinal(
        openingFund,
        [{ amount: expensesAgg._sum.amount }],
        [{ amount: currentExpensesAgg._sum?.amount }],
      )

      const updatedShift = await tx.shift.update({
        where: { id: shiftId },
        data: {
          ...(close ? { cash: close.cash, caixaBankAmount: close.caixaBankAmount, santanderAmount: close.santanderAmount } : {}),
          ...(data.cash !== undefined && !close && { cash: data.cash }),
          ...(data.caixaBankAmount !== undefined && !close && { caixaBankAmount: data.caixaBankAmount }),
          ...(data.santanderAmount !== undefined && !close && { santanderAmount: data.santanderAmount }),
          ...(openingFund !== toN(lockedShift.openingFund) && { openingFund }),
          ...(data.status && { status: data.status }),
          ...(data.status === "CERRADO" && { closedAt: new Date() }),
          ...(data.status === "ABIERTO" && { closedAt: null }),
          closingFund,
        },
        include: { expenses: true, shiftClose: true },
      })

      if (close) {
        if (!closeTimes) throw new Error("Faltan las fechas del cierre durante la actualización")
        await tx.shiftClose.upsert({
          where: { shiftId },
          create: {
            shiftId,
            cashCloseNumber: close.cashCloseNumber,
            openingDateTime: closeTimes.opening,
            closingDateTime: closeTimes.closing,
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
            openingDateTime: closeTimes.opening,
            closingDateTime: closeTimes.closing,
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

      if (data.status === "CERRADO" && data.operationalReview) {
        await tx.shiftOperationalReview.upsert({
          where: { shiftId },
          create: {
            shiftId,
            productionReviewed: true,
            wasteReviewed: true,
            confirmedById: session.user.id,
          },
          update: {
            productionReviewed: true,
            wasteReviewed: true,
            confirmedById: session.user.id,
            confirmedAt: new Date(),
          },
        })
      }

      return updatedShift
    })
  } catch (error) {
    if (error instanceof HistoricalShiftReopenError) {
      return NextResponse.json(
        { error: "Solo se puede reabrir el último turno; hay turnos posteriores registrados" },
        { status: 409 },
      )
    }
    throw error
  }

  return NextResponse.json(updated)
})
