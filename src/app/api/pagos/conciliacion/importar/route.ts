import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { prisma } from "@/lib/prisma"
import { auditPaymentEvent, requireOpenAccountingPeriod, requirePaymentFunction } from "@/lib/payments"
import { paymentErrorResponse } from "@/lib/payments-http"
import { FundsAccountStatus, PaymentFunction, statementMovementDirectionSchema } from "@/lib/database-enums"

const importSchema = z.object({
  fundsAccountId: z.string().min(1),
  fileName: z.string().trim().min(1).max(200),
  movements: z.array(z.object({
    valueDate: z.string().min(1),
    description: z.string().trim().min(1).max(200),
    externalReference: z.string().trim().max(100).optional(),
    direction: statementMovementDirectionSchema,
    amount: z.coerce.number().finite().positive(),
  }).strict()).min(1).max(2_000),
}).strict()

export const POST = withAuth(async (req, session) => {
  try {
    const input = importSchema.parse(await req.json())
    const account = await prisma.fundsAccount.findUnique({ where: { id: input.fundsAccountId }, select: { id: true, entity: true, status: true } })
    if (!account || account.status !== FundsAccountStatus.ACTIVE) return NextResponse.json({ error: "Cuenta no disponible" }, { status: 409 })
    await requirePaymentFunction(session.user.id, PaymentFunction.RECONCILE, account.entity, session.user.role)
    const dates = input.movements.map((item) => new Date(item.valueDate)).filter((date) => Number.isFinite(date.getTime()))
    if (dates.length !== input.movements.length) return NextResponse.json({ error: "Hay fechas de extracto no válidas" }, { status: 400 })
    const canonicalMovements = input.movements
      .map((item) => ({
        valueDate: new Date(item.valueDate).toISOString(),
        description: item.description,
        externalReference: item.externalReference || null,
        direction: item.direction,
        amount: item.amount,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    const fileHash = createHash("sha256").update(JSON.stringify(canonicalMovements)).digest("hex")
    const existingImport = await prisma.statementImport.findFirst({
      where: { fundsAccountId: account.id, fileHash },
      select: { id: true },
    })
    if (existingImport) return NextResponse.json({ error: "Este extracto ya fue importado", code: "STATEMENT_ALREADY_IMPORTED" }, { status: 409 })

    const periods = new Set(dates.map((date) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`))
    const imported = await prisma.$transaction(async (tx) => {
      for (const period of periods) {
        const [year, month] = period.split("-").map(Number)
        await requireOpenAccountingPeriod(tx, account.entity, new Date(Date.UTC(year, month - 1, 1)))
      }
      const created = await tx.statementImport.create({
        data: {
          fundsAccountId: account.id,
          fileName: input.fileName,
          fileHash,
          startDate: new Date(Math.min(...dates.map((date) => date.getTime()))),
          endDate: new Date(Math.max(...dates.map((date) => date.getTime()))),
          createdById: session.user.id,
          movements: { create: input.movements.map((item) => ({ valueDate: new Date(item.valueDate), description: item.description, externalReference: item.externalReference || null, direction: item.direction, amount: item.amount, fundsAccount: { connect: { id: account.id } } })) },
        },
        include: { movements: true },
      })
      await auditPaymentEvent(tx, { actorId: session.user.id, action: "EXTRACTO_IMPORTADO", recordType: "ImportacionExtracto", recordId: created.id, entity: account.entity, after: { movements: created.movements.length, fileName: input.fileName, fileHash } })
      return created
    })
    return NextResponse.json(imported, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este extracto ya fue importado", code: "STATEMENT_ALREADY_IMPORTED" }, { status: 409 })
    }
    return paymentErrorResponse(error)
  }
})
