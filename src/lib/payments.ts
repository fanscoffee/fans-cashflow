import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { recalculateShiftFundFinal } from "@/lib/shift-fund"
import {
  CreditorStatus,
  CreditorType,
  CurrentExpenseStatus,
  ExpenseReceiptType,
  FundsAccountStatus,
  FundsAccountType,
  FundsMovementType,
  InvoiceWorkflowStatus,
  MonthlyCloseStatus,
  PaymentApplicationType,
  PaymentEntity as PaymentEntityValues,
  PaymentFunction as PaymentFunctionValues,
  PaymentMethodStatus,
  PaymentMethodType,
  PaymentStatus,
  StatementMovementDirection,
  StatementMovementStatus,
  UserRole,
  parseExpenseReceiptType,
  parsePaymentApplicationType,
  parsePaymentEntity,
  parsePaymentFunction,
  parseUserRole,
  type DatabaseCurrentExpenseStatus,
  type DatabaseInvoiceWorkflowStatus,
  type DatabasePaymentApplicationType,
  type DatabasePaymentFunction,
} from "@/lib/database-enums"

function compatibilityEnumSchema<T extends string>(parser: (value: string) => T | undefined) {
  return z.string().transform((value, context) => {
    const parsed = parser(value)
    if (!parsed) {
      context.addIssue({ code: "custom", message: "Valor no válido" })
      return z.NEVER
    }
    return parsed
  })
}

export const paymentEntitySchema = compatibilityEnumSchema(parsePaymentEntity)
export const paymentFunctionSchema = compatibilityEnumSchema(parsePaymentFunction)

export const applicationSchema = z.object({
  destinationType: compatibilityEnumSchema(parsePaymentApplicationType),
  destinationId: z.string().min(1),
  appliedAmount: z.coerce.number().finite().positive().max(1_000_000_000),
})

export const createPaymentSchema = z.object({
  entity: paymentEntitySchema,
  paymentDate: z.string().min(1),
  paymentMethodId: z.string().min(1),
  fundsAccountId: z.string().min(1),
  creditorId: z.string().min(1),
  externalReference: z.string().trim().max(40).optional(),
  applications: z.array(applicationSchema).min(1, "El pago debe aplicarse a un documento").max(100),
  excessAuthorizedById: z.string().optional(),
  excessReason: z.string().trim().max(500).optional(),
})

export const createExpenseSchema = z.object({
  entity: paymentEntitySchema,
  categoryId: z.string().min(1),
  creditorId: z.string().optional(),
  contractId: z.string().optional(),
  concept: z.string().trim().min(2).max(120),
  accrualDate: z.string().min(1),
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
  receipt: compatibilityEnumSchema(parseExpenseReceiptType),
})

export const createShiftExpenseSchema = createExpenseSchema.omit({ entity: true, receipt: true })

export const authorizeExpenseSchema = z.object({
  authorizerId: z.string().min(1),
  approve: z.boolean().optional(),
  aprobar: z.boolean().optional(),
  rejectionReason: z.string().trim().max(500).optional(),
}).refine((input) => input.approve !== undefined || input.aprobar !== undefined, {
  path: ["approve"],
  message: "La decisión de autorización es obligatoria",
}).transform(({ approve, aprobar, ...input }) => ({
  ...input,
  approve: approve ?? aprobar ?? false,
}))

export const createAdvanceSchema = z.object({
  entity: paymentEntitySchema,
  creditorId: z.string().min(1),
  concept: z.string().trim().min(2).max(120),
  date: z.string().min(1),
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
})

export const authorizeAdvanceSchema = z.object({
  authorizerId: z.string().min(1),
  approve: z.boolean().optional(),
  aprobar: z.boolean().optional(),
}).refine((input) => input.approve !== undefined || input.aprobar !== undefined, {
  path: ["approve"],
  message: "La decisión de autorización es obligatoria",
}).transform(({ approve, aprobar, ...input }) => ({
  ...input,
  approve: approve ?? aprobar ?? false,
}))

export type PaymentEntity = z.infer<typeof paymentEntitySchema>
export type PaymentFunction = z.infer<typeof paymentFunctionSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type CreateShiftExpenseInput = z.infer<typeof createShiftExpenseSchema>

export class PaymentDomainError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = "PAYMENT_VALIDATION") {
    super(message)
    this.name = "PaymentDomainError"
    this.status = status
    this.code = code
  }
}

type Database = typeof prisma | Prisma.TransactionClient

function decimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value)
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), decimal(0))
}

function parseDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new PaymentDomainError("Fecha no válida")
  return date
}

export function serializePaymentError(error: unknown) {
  if (error instanceof PaymentDomainError) {
    return { error: error.message, code: error.code, status: error.status }
  }
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message || "Datos no válidos", code: "INVALID_INPUT", status: 400 }
  }
  return { error: "Error interno del módulo de pagos", code: "PAYMENT_ERROR", status: 500 }
}

export async function userHasPaymentFunction(
  userId: string,
  functionName: PaymentFunction,
  entity?: PaymentEntity,
  role?: string,
  db: Database = prisma,
) {
  const normalizedRole = parseUserRole(role)
  const assignment = await db.userPaymentAssignment.findFirst({
    where: {
      userId,
      function: functionName,
      active: true,
      OR: [{ entity: null }, ...(entity ? [{ entity: entity }] : [])],
      validFrom: { lte: new Date() },
      AND: [{ OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
    },
    select: { id: true },
  })
  if (assignment) return true

  // ADMIN remains the emergency owner role. PARTNER keeps the legacy access only
  // until assignments for that function have been configured at least once.
  if (normalizedRole === UserRole.ADMIN) return true
  const legacyAccessFunctions: DatabasePaymentFunction[] = [
    PaymentFunctionValues.REGISTER,
    PaymentFunctionValues.REQUEST,
    PaymentFunctionValues.AUTHORIZE,
    PaymentFunctionValues.EXECUTE,
    PaymentFunctionValues.RECONCILE,
  ]
  if (normalizedRole === UserRole.PARTNER && legacyAccessFunctions.includes(functionName)) {
    const configured = await db.userPaymentAssignment.findFirst({
      where: { function: functionName, active: true },
      select: { id: true },
    })
    return !configured
  }
  return false
}

export async function requirePaymentFunction(
  userId: string,
  functionName: PaymentFunction,
  entity: PaymentEntity | undefined,
  role: string,
  db: Database = prisma,
) {
  const allowed = await userHasPaymentFunction(userId, functionName, entity, role, db)
  if (!allowed) throw new PaymentDomainError("No tienes permiso para esta operación", 403, "PAYMENT_FORBIDDEN")
}

export async function requireOpenAccountingPeriod(
  db: Database,
  entity: PaymentEntity,
  date: Date,
) {
  const closure = await db.monthlyClose.findUnique({
    where: {
      entity_year_month: {
        entity: entity,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
      },
    },
    select: { status: true },
  })
  if (closure && closure.status !== MonthlyCloseStatus.OPEN) {
    throw new PaymentDomainError("El periodo contable está cerrado", 409, "ACCOUNTING_PERIOD_CLOSED")
  }
}

export async function requireAmountAuthorization(
  userId: string,
  role: string,
  entity: PaymentEntity,
  amount: number | string | Prisma.Decimal,
  db: Database = prisma,
) {
  const rules = await db.authorizationRule.findMany({
    where: {
      active: true,
      requiredFunction: PaymentFunctionValues.AUTHORIZE,
      amountFrom: { lte: decimal(amount) },
      OR: [{ entity: entity }, { entity: null }],
      AND: [{ OR: [{ amountTo: null }, { amountTo: { gt: decimal(amount) } }] }, { validFrom: { lte: new Date() } }, { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] }],
    },
    orderBy: [{ entity: "desc" }, { amountFrom: "desc" }, { version: "desc" }],
    take: 1,
  })
  if (!rules[0]) throw new PaymentDomainError("La matriz de autorización no está configurada para este importe", 409, "AUTHORIZATION_MATRIX_NOT_CONFIGURED")
  const requiredFunction = rules[0].requiredFunction
  await requirePaymentFunction(userId, requiredFunction, entity, role, db)
}

export async function auditPaymentEvent(
  db: Database,
  input: {
    actorId?: string
    action: string
    recordType: string
    recordId: string
    entity?: PaymentEntity
    reason?: string
    before?: unknown
    after?: unknown
  },
) {
  return db.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      recordType: input.recordType,
      recordId: input.recordId,
      entity: input.entity,
      reason: input.reason,
      before: input.before as Prisma.InputJsonValue | undefined,
      after: input.after as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function ensureCreditorForSupplier(
  db: Database,
  provider: { id: string; legalName: string; taxId: string },
  createdById?: string,
) {
  return db.creditor.upsert({
    where: { supplierId: provider.id },
    update: { name: provider.legalName, taxId: provider.taxId, status: CreditorStatus.ACTIVE },
    create: {
      code: `PRV-${provider.id.slice(-8).toUpperCase()}`,
      type: CreditorType.MERCHANDISE_SUPPLIER,
      name: provider.legalName,
      taxId: provider.taxId,
      supplierId: provider.id,
      createdById: createdById || null,
    },
  })
}

async function ensureCreditorCompraMenor(entity: PaymentEntity, createdById: string) {
  const legacyEntity = entity === PaymentEntityValues.BAKERY ? "OBRADOR" : "CAFETERIA"
  const code = `MEN-${legacyEntity}`
  return prisma.creditor.upsert({
    where: { code: code },
    update: { status: CreditorStatus.ACTIVE },
    create: { code: code, type: CreditorType.OTHER, name: `Compras menores ${legacyEntity.toLowerCase()}`, defaultEntity: entity, status: CreditorStatus.ACTIVE, createdById },
  })
}

async function lockTarget(db: Prisma.TransactionClient, type: "Invoice" | "CurrentExpense" | "Advance", id: string) {
  if (type === "Invoice") {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`)
  } else if (type === "CurrentExpense") {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "CurrentExpense" WHERE "id" = ${id} FOR UPDATE`)
  } else {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Advance" WHERE "id" = ${id} FOR UPDATE`)
  }
}

async function lockFundAccount(db: Prisma.TransactionClient, id: string) {
  await db.$queryRaw(Prisma.sql`SELECT "id" FROM "FundsAccount" WHERE "id" = ${id} FOR UPDATE`)
}

export async function existingApplicationTotal(db: Prisma.TransactionClient, field: "invoiceId" | "currentExpenseId" | "advanceId", id: string) {
  const aggregate = await db.paymentApplication.aggregate({
    _sum: { appliedAmount: true },
    where: { [field]: id, payment: { status: { not: PaymentStatus.VOID } } },
  })
  return decimal(aggregate._sum?.appliedAmount || 0)
}

async function nextPaymentNumber(db: Prisma.TransactionClient, entity: PaymentEntity) {
  const sequence = await db.paymentSequence.upsert({
    where: { entity: entity },
    create: { entity: entity, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  })
  return sequence.lastNumber
}

type PaymentTarget = {
  destinationType: DatabasePaymentApplicationType
  destinationId: string
  appliedAmount: Prisma.Decimal
  invoice?: { id: string; entity: PaymentEntity; creditorId: string | null; confirmedById: string; workflowStatus: DatabaseInvoiceWorkflowStatus; confirmedAmount: Prisma.Decimal | null; withheldAmount: Prisma.Decimal }
  expense?: { id: string; entity: PaymentEntity; creditorId: string | null; authorizerId: string | null; status: DatabaseCurrentExpenseStatus; amount: Prisma.Decimal; category: { code: string } }
  advance?: { id: string; entity: PaymentEntity; creditorId: string; authorizedById: string | null; status: DatabaseCurrentExpenseStatus; amount: Prisma.Decimal; appliedAmount: Prisma.Decimal }
}

async function loadAndValidateTarget(
  db: Prisma.TransactionClient,
  input: z.infer<typeof applicationSchema>,
  entity: PaymentEntity,
  creditorId: string,
  allowExcess: boolean,
) : Promise<PaymentTarget> {
  const amount = decimal(input.appliedAmount)
  if (input.destinationType === PaymentApplicationType.INVOICE) {
    await lockTarget(db, "Invoice", input.destinationId)
    const invoice = await db.invoice.findUnique({
      where: { id: input.destinationId },
      select: { id: true, entity: true, creditorId: true, confirmedById: true, workflowStatus: true, confirmedAmount: true, withheldAmount: true },
    })
    if (!invoice) throw new PaymentDomainError("Factura no encontrada", 404, "DOCUMENT_NOT_FOUND")
    if (invoice.entity !== entity) throw new PaymentDomainError("La factura pertenece a otra entidad", 409, "ENTITY_MISMATCH")
    if (!invoice.creditorId || invoice.creditorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con la factura", 409, "CREDITOR_MISMATCH")
    if (invoice.workflowStatus !== InvoiceWorkflowStatus.CONFIRMED && invoice.workflowStatus !== InvoiceWorkflowStatus.PARTIALLY_CONFIRMED) throw new PaymentDomainError("La factura no está conformada", 409, "DOCUMENT_NOT_PAYABLE")
    if (!invoice.confirmedAmount) throw new PaymentDomainError("La factura no tiene importe conformado", 409, "MISSING_CONFORMED_AMOUNT")
    const applied = await existingApplicationTotal(db, "invoiceId", invoice.id)
    const pending = invoice.confirmedAmount.minus(applied)
    if (amount.greaterThan(pending) && !allowExcess) throw new PaymentDomainError("El importe supera el pendiente conformado", 409, "AMOUNT_OVER_PENDING")
    return { destinationType: input.destinationType, destinationId: input.destinationId, appliedAmount: amount, invoice }
  }

  if (input.destinationType === PaymentApplicationType.EXPENSE) {
    await lockTarget(db, "CurrentExpense", input.destinationId)
    const expense = await db.currentExpense.findUnique({
      where: { id: input.destinationId },
      select: { id: true, entity: true, creditorId: true, authorizerId: true, status: true, amount: true, category: { select: { code: true } } },
    })
    if (!expense) throw new PaymentDomainError("Gasto no encontrado", 404, "DOCUMENT_NOT_FOUND")
    if (expense.entity !== entity) throw new PaymentDomainError("El gasto pertenece a otra entidad", 409, "ENTITY_MISMATCH")
    if (!expense.creditorId || expense.creditorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con el gasto", 409, "CREDITOR_MISMATCH")
    if (expense.status !== CurrentExpenseStatus.AUTHORIZED && expense.status !== CurrentExpenseStatus.PAID) throw new PaymentDomainError("El gasto no está autorizado", 409, "DOCUMENT_NOT_PAYABLE")
    const applied = await existingApplicationTotal(db, "currentExpenseId", expense.id)
    if (amount.greaterThan(expense.amount.minus(applied))) throw new PaymentDomainError("El importe supera el pendiente del gasto", 409, "AMOUNT_OVER_PENDING")
    if (expense.category.code === "MEN") {
      if (!allowExcess && input.appliedAmount <= 0) throw new PaymentDomainError("Compra menor no válida")
    }
    return { destinationType: input.destinationType, destinationId: input.destinationId, appliedAmount: amount, expense }
  }

  await lockTarget(db, "Advance", input.destinationId)
  const advance = await db.advance.findUnique({
    where: { id: input.destinationId },
    select: { id: true, entity: true, creditorId: true, authorizedById: true, status: true, amount: true, appliedAmount: true },
  })
  if (!advance) throw new PaymentDomainError("Anticipo no encontrado", 404, "DOCUMENT_NOT_FOUND")
  if (advance.entity !== entity) throw new PaymentDomainError("El anticipo pertenece a otra entidad", 409, "ENTITY_MISMATCH")
  if (advance.creditorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con el anticipo", 409, "CREDITOR_MISMATCH")
  if (advance.status !== CurrentExpenseStatus.AUTHORIZED && advance.status !== CurrentExpenseStatus.PAID) throw new PaymentDomainError("El anticipo no está autorizado", 409, "DOCUMENT_NOT_PAYABLE")
  const pending = advance.amount.minus(advance.appliedAmount)
  if (amount.greaterThan(pending)) throw new PaymentDomainError("El importe supera el pendiente del anticipo", 409, "AMOUNT_OVER_PENDING")
  return { destinationType: input.destinationType, destinationId: input.destinationId, appliedAmount: amount, advance }
}

export async function createPayment(user: { id: string; role: string }, input: CreatePaymentInput) {
  await requirePaymentFunction(user.id, PaymentFunctionValues.EXECUTE, input.entity, user.role)
  const parsedDate = parseDate(input.paymentDate)

  return prisma.$transaction(async (tx) => {
    await requireOpenAccountingPeriod(tx, input.entity, parsedDate)
    await lockFundAccount(tx, input.fundsAccountId)
    const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } })
    if (!method || method.status !== PaymentMethodStatus.ACTIVE) throw new PaymentDomainError("Medio de pago no disponible", 409, "PAYMENT_METHOD_UNAVAILABLE")
    const account = await tx.fundsAccount.findUnique({ where: { id: input.fundsAccountId } })
    if (!account || account.status !== FundsAccountStatus.ACTIVE) throw new PaymentDomainError("Cuenta de fondos no disponible", 409, "FUND_ACCOUNT_UNAVAILABLE")
    if (account.entity !== input.entity) throw new PaymentDomainError("La cuenta no pertenece a la entidad del pago", 409, "ENTITY_MISMATCH")
    if (method.requiresAccount && !input.fundsAccountId) throw new PaymentDomainError("La cuenta de origen es obligatoria")
    if (method.type === PaymentMethodType.CASH && account.type !== FundsAccountType.CASH_BOX && account.type !== FundsAccountType.PETTY_CASH) throw new PaymentDomainError("El efectivo debe salir de una caja", 409, "CASH_ACCOUNT_REQUIRED")
    if (method.transactionLimit && sum(input.applications.map((item) => decimal(item.appliedAmount))).greaterThan(method.transactionLimit)) throw new PaymentDomainError("El pago supera el límite del medio", 409, "PAYMENT_METHOD_LIMIT")

    if (input.excessAuthorizedById || input.excessReason) {
      throw new PaymentDomainError("Los excesos requieren una aprobación registrada antes de ejecutar el pago", 409, "EXCESS_APPROVAL_REQUIRED")
    }

    const creditor = await tx.creditor.findUnique({ where: { id: input.creditorId }, select: { id: true, status: true, type: true } })
    if (!creditor || creditor.status !== CreditorStatus.ACTIVE) throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
    if (creditor.type === CreditorType.MERCHANDISE_SUPPLIER && input.applications.some((application) => application.destinationType !== PaymentApplicationType.INVOICE)) throw new PaymentDomainError("Un proveedor de mercancía solo puede pagarse mediante facturas conformadas", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
    const destinations = input.applications.map((application) => `${application.destinationType}:${application.destinationId}`)
    if (new Set(destinations).size !== destinations.length) throw new PaymentDomainError("No puedes repetir el mismo documento en un pago", 409, "DUPLICATE_APPLICATION")

    const targets: PaymentTarget[] = []
    for (const application of input.applications) {
      targets.push(await loadAndValidateTarget(tx, application, input.entity, input.creditorId, false))
    }
    if (targets.some((target) =>
      target.invoice?.confirmedById === user.id ||
      target.expense?.authorizerId === user.id ||
      target.advance?.authorizedById === user.id
    )) {
      throw new PaymentDomainError("El autorizador del documento no puede ejecutar su propio pago", 409, "SEGREGATION_VIOLATION")
    }
    if (targets.some((target) => target.expense?.category.code === "MEN") && account.type !== FundsAccountType.PETTY_CASH) throw new PaymentDomainError("Las compras menores solo se pagan desde caja chica", 409, "MINOR_PURCHASE_CASH_ONLY")
    const total = sum(targets.map((target) => target.appliedAmount))
    if (total.lte(0)) throw new PaymentDomainError("El importe total debe ser mayor que cero")

    if (method.type === PaymentMethodType.CASH && account.theoreticalBalance.lessThan(total)) throw new PaymentDomainError("Saldo insuficiente en la caja", 409, "INSUFFICIENT_CASH")

    const number = await nextPaymentNumber(tx, input.entity)
    const payment = await tx.payment.create({
      data: {
        number: number,
        entity: input.entity,
        paymentDate: parsedDate,
        paymentMethodId: input.paymentMethodId,
        fundsAccountId: input.fundsAccountId,
        creditorId: input.creditorId,
        totalAmount: total,
        externalReference: input.externalReference || null,
        executedById: user.id,
        status: PaymentStatus.ORDERED,
        excessAuthorizedById: input.excessAuthorizedById || null,
        excessReason: input.excessReason || null,
        applications: {
          create: targets.map((target) => ({
            destinationType: target.destinationType,
            invoiceId: target.destinationType === PaymentApplicationType.INVOICE ? target.destinationId : null,
            currentExpenseId: target.destinationType === PaymentApplicationType.EXPENSE ? target.destinationId : null,
            advanceId: target.destinationType === PaymentApplicationType.ADVANCE ? target.destinationId : null,
            appliedAmount: target.appliedAmount,
          })),
        },
      },
      include: { applications: true },
    })

    await tx.fundsMovement.create({
      data: {
        fundsAccountId: account.id,
        entity: input.entity,
        type: FundsMovementType.PAYMENT_OUTFLOW,
        amount: total.negated(),
        description: `Pago ${input.entity}-${number}`,
        sourceType: "PAGO",
        sourceId: payment.id,
        paymentId: payment.id,
        createdById: user.id,
      },
    })
    await tx.fundsAccount.update({ where: { id: account.id }, data: { theoreticalBalance: { decrement: total } } })

    for (const target of targets) {
      if (target.invoice) {
        const applied = await existingApplicationTotal(tx, "invoiceId", target.invoice.id)
        const remaining = target.invoice.confirmedAmount!.minus(applied)
        await tx.invoice.update({
          where: { id: target.invoice.id },
          data: { paymentStatus: remaining.lte(0) ? "PAGADA" : "PARCIAL", paidAmount: applied },
        })
      }
      if (target.expense) {
        const applied = await existingApplicationTotal(tx, "currentExpenseId", target.expense.id)
        await tx.currentExpense.update({ where: { id: target.expense.id }, data: { status: applied.gte(target.expense.amount) ? CurrentExpenseStatus.PAID : CurrentExpenseStatus.AUTHORIZED } })
      }
      if (target.advance) {
        await tx.advance.update({ where: { id: target.advance.id }, data: { appliedAmount: { increment: target.appliedAmount }, status: target.advance.appliedAmount.plus(target.appliedAmount).gte(target.advance.amount) ? CurrentExpenseStatus.PAID : CurrentExpenseStatus.AUTHORIZED } })
      }
    }

    await auditPaymentEvent(tx, { actorId: user.id, action: "PAGO_CREADO", recordType: "Pago", recordId: payment.id, entity: input.entity, reason: input.excessReason, after: { number: number, totalAmount: total.toString(), applications: input.applications } })
    return payment
  })
}

export async function createExpense(user: { id: string; role: string }, input: CreateExpenseInput, options: { shiftId?: string; employeeShiftRegistration?: boolean } = {}) {
  const normalizedRole = parseUserRole(user.role)
  const isEmployeeShiftRegistration = options.employeeShiftRegistration === true && options.shiftId && normalizedRole === UserRole.EMPLOYEE
  if (!isEmployeeShiftRegistration) await requirePaymentFunction(user.id, PaymentFunctionValues.REQUEST, input.entity, user.role)
  const date = parseDate(input.accrualDate)
  const amount = decimal(input.amount)
  await requireOpenAccountingPeriod(prisma, input.entity, date)

  const category = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, code: true, active: true } })
  if (!category?.active) throw new PaymentDomainError("Categoría de gasto no disponible", 409, "CATEGORY_UNAVAILABLE")

  if (input.concept.trim().split(/\s+/).length === 1) throw new PaymentDomainError("El concepto debe ser específico y no una sola palabra", 400, "GENERIC_CONCEPT")
  if (!input.creditorId && category.code !== "PER" && !(category.code === "MEN" && input.receipt === ExpenseReceiptType.NO_RECEIPT)) throw new PaymentDomainError("El acreedor es obligatorio para este gasto", 400, "CREDITOR_REQUIRED")

  if (category.code === "OTR") {
    const direction = await userHasPaymentFunction(user.id, PaymentFunctionValues.AUTHORIZE, input.entity, user.role)
    if (!direction) throw new PaymentDomainError("La categoría OTR requiere autorización de dirección", 403, "OTHER_CATEGORY_REQUIRES_DIRECTION")
  }

  if (input.creditorId) {
    const creditor = await prisma.creditor.findUnique({ where: { id: input.creditorId }, select: { type: true, status: true } })
    if (!creditor || creditor.status !== CreditorStatus.ACTIVE) throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
    if (creditor.type === CreditorType.MERCHANDISE_SUPPLIER) throw new PaymentDomainError("Un proveedor de mercancía solo puede pagarse mediante factura conformada", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
  }

  const creditorId = input.creditorId || (category.code === "MEN" ? (await ensureCreditorCompraMenor(input.entity, user.id)).id : null)
  const expense = await prisma.currentExpense.create({
    data: {
      entity: input.entity,
      categoryId: input.categoryId,
      creditorId: creditorId,
      contractId: input.contractId || null,
      shiftId: options.shiftId || null,
      concept: input.concept.trim(),
      accrualDate: date,
      amount: amount,
      receipt: input.receipt,
      requesterId: user.id,
      status: CurrentExpenseStatus.PENDING_AUTHORIZATION,
    },
  })
  await auditPaymentEvent(prisma, { actorId: user.id, action: "GASTO_CREADO", recordType: "GastoCorriente", recordId: expense.id, entity: input.entity, after: { amount: amount.toString(), categoryId: input.categoryId, shiftId: options.shiftId || null } })
  return expense
}

export async function createExpenseFromShift(user: { id: string; role: string }, shiftId: string, input: CreateShiftExpenseInput) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { id: true, status: true, createdById: true } })
  const normalizedRole = parseUserRole(user.role)
  const canManageAllShifts = normalizedRole === UserRole.ADMIN || normalizedRole === UserRole.PARTNER
  if (!shift || (!canManageAllShifts && shift.createdById !== user.id)) throw new PaymentDomainError("Turno no encontrado", 404, "SHIFT_NOT_FOUND")
  if (shift.status !== "ABIERTO") throw new PaymentDomainError("El turno debe estar abierto para registrar el gasto", 409, "SHIFT_NOT_OPEN")

  const expense = await createExpense(user, { ...input, entity: PaymentEntityValues.COFFEE_SHOP, receipt: ExpenseReceiptType.NO_RECEIPT }, { shiftId, employeeShiftRegistration: normalizedRole === UserRole.EMPLOYEE })
  await recalculateShiftFundFinal(shiftId)
  return expense
}

export async function createAdvance(user: { id: string; role: string }, input: z.infer<typeof createAdvanceSchema>) {
  await requirePaymentFunction(user.id, PaymentFunctionValues.REQUEST, input.entity, user.role)
  const date = parseDate(input.date)
  await requireOpenAccountingPeriod(prisma, input.entity, date)
  if (input.concept.trim().split(/\s+/).length === 1) throw new PaymentDomainError("El concepto debe ser específico y no una sola palabra", 400, "GENERIC_CONCEPT")
  const creditor = await prisma.creditor.findUnique({ where: { id: input.creditorId }, select: { id: true, type: true, status: true } })
  if (!creditor || creditor.status !== CreditorStatus.ACTIVE) throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
  if (creditor.type === CreditorType.MERCHANDISE_SUPPLIER) throw new PaymentDomainError("Un proveedor de mercancía no puede recibir anticipos por este circuito", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
  const advance = await prisma.advance.create({ data: { entity: input.entity, creditorId: input.creditorId, concept: input.concept.trim(), date: date, amount: input.amount, requestedById: user.id, status: CurrentExpenseStatus.PENDING_AUTHORIZATION } })
  await auditPaymentEvent(prisma, { actorId: user.id, action: "ANTICIPO_CREADO", recordType: "Anticipo", recordId: advance.id, entity: input.entity, after: { amount: input.amount, creditorId: input.creditorId } })
  return advance
}

export async function authorizeAdvance(user: { id: string; role: string }, advanceId: string, input: z.infer<typeof authorizeAdvanceSchema>) {
  const advance = await prisma.advance.findUnique({ where: { id: advanceId } })
  if (!advance) throw new PaymentDomainError("Anticipo no encontrado", 404, "DOCUMENT_NOT_FOUND")
  await requirePaymentFunction(user.id, PaymentFunctionValues.AUTHORIZE, advance.entity, user.role)
  await requireOpenAccountingPeriod(prisma, advance.entity, advance.date)
  if (input.authorizerId !== user.id) throw new PaymentDomainError("El autorizador debe ser el usuario autenticado", 403, "AUTHORIZER_MISMATCH")
  if (advance.requestedById === user.id) throw new PaymentDomainError("Nadie puede autorizar su propio anticipo", 409, "SEGREGATION_VIOLATION")
  if (advance.status !== CurrentExpenseStatus.PENDING_AUTHORIZATION) throw new PaymentDomainError("El anticipo no está pendiente de autorización", 409, "INVALID_STATE")
  await requireAmountAuthorization(user.id, user.role, advance.entity, advance.amount)
  const updated = await prisma.advance.update({ where: { id: advance.id }, data: input.approve ? { status: CurrentExpenseStatus.AUTHORIZED, authorizedById: user.id } : { status: CurrentExpenseStatus.VOID, authorizedById: user.id } })
  await auditPaymentEvent(prisma, { actorId: user.id, action: input.approve ? "ANTICIPO_AUTORIZADO" : "ANTICIPO_RECHAZADO", recordType: "Anticipo", recordId: advance.id, entity: advance.entity })
  return updated
}

export async function authorizeExpense(user: { id: string; role: string }, expenseId: string, input: z.infer<typeof authorizeExpenseSchema>) {
  const expense = await prisma.currentExpense.findUnique({ where: { id: expenseId }, include: { category: true } })
  if (!expense) throw new PaymentDomainError("Gasto no encontrado", 404, "DOCUMENT_NOT_FOUND")
  await requirePaymentFunction(user.id, PaymentFunctionValues.AUTHORIZE, expense.entity, user.role)
  await requireOpenAccountingPeriod(prisma, expense.entity, expense.accrualDate)
  if (input.authorizerId !== user.id) throw new PaymentDomainError("El autorizador debe ser el usuario autenticado", 403, "AUTHORIZER_MISMATCH")
  if (expense.requesterId === user.id) throw new PaymentDomainError("Nadie puede autorizar su propio gasto", 409, "SEGREGATION_VIOLATION")
  if (expense.status !== CurrentExpenseStatus.PENDING_AUTHORIZATION) throw new PaymentDomainError("El gasto no está pendiente de autorización", 409, "INVALID_STATE")
  if (!input.approve && !input.rejectionReason) throw new PaymentDomainError("El rechazo debe tener un motivo")
  if (input.approve) await requireAmountAuthorization(user.id, user.role, expense.entity, expense.amount)

  const updated = await prisma.currentExpense.update({
    where: { id: expense.id },
    data: input.approve ? { status: CurrentExpenseStatus.AUTHORIZED, authorizerId: user.id, authorizedAt: new Date(), rejectionReason: null } : { status: CurrentExpenseStatus.REJECTED, authorizerId: user.id, authorizedAt: new Date(), rejectionReason: input.rejectionReason },
  })
  await auditPaymentEvent(prisma, { actorId: user.id, action: input.approve ? "GASTO_AUTORIZADO" : "GASTO_RECHAZADO", recordType: "GastoCorriente", recordId: expense.id, entity: expense.entity, reason: input.rejectionReason })
  return updated
}

export async function deleteCurrentExpense(user: { id: string; role: string }, expenseId: string) {
  const normalizedRole = parseUserRole(user.role)
  if (normalizedRole !== UserRole.ADMIN && normalizedRole !== UserRole.PARTNER) {
    throw new PaymentDomainError("No tienes permiso para eliminar gastos corrientes", 403, "PAYMENT_FORBIDDEN")
  }

  const expense = await prisma.currentExpense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      entity: true,
      shiftId: true,
      accrualDate: true,
      status: true,
      amount: true,
      applications: { select: { id: true } },
    },
  })
  if (!expense || !expense.shiftId || expense.status === CurrentExpenseStatus.VOID) {
    throw new PaymentDomainError("Gasto corriente no encontrado", 404, "DOCUMENT_NOT_FOUND")
  }
  await requireOpenAccountingPeriod(prisma, expense.entity, expense.accrualDate)
  if (expense.applications.length > 0) {
    throw new PaymentDomainError("No se puede eliminar un gasto con pagos aplicados", 409, "EXPENSE_HAS_PAYMENTS")
  }

  const updated = await prisma.currentExpense.update({
    where: { id: expense.id },
    data: { status: CurrentExpenseStatus.VOID },
  })
  await auditPaymentEvent(prisma, {
    actorId: user.id,
    action: "GASTO_ANULADO",
    recordType: "GastoCorriente",
    recordId: expense.id,
    entity: expense.entity,
    reason: "Eliminado desde el seguimiento de gastos corrientes",
    before: { status: expense.status, amount: expense.amount.toString(), shiftId: expense.shiftId },
    after: { status: "ANULADO", amount: expense.amount.toString(), shiftId: expense.shiftId },
  })
  await recalculateShiftFundFinal(expense.shiftId)
  return updated
}

export async function getPaymentDashboard(entity?: PaymentEntity) {
  const where: { entity?: PaymentEntity } = entity ? { entity } : {}
  const [invoices, expenses, pendingExpenses, payments, cashAccounts, methods] = await Promise.all([
    prisma.invoice.findMany({ where: { ...where, workflowStatus: { in: [InvoiceWorkflowStatus.CONFIRMED, InvoiceWorkflowStatus.PARTIALLY_CONFIRMED] }, creditorId: { not: null } }, include: { creditor: { select: { id: true, name: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } }, select: { appliedAmount: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 100 }),
    prisma.currentExpense.findMany({ where: { ...where, status: { in: [CurrentExpenseStatus.PENDING_AUTHORIZATION, CurrentExpenseStatus.AUTHORIZED] } }, include: { category: true, creditor: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, shift: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } }, select: { appliedAmount: true } } }, orderBy: { accrualDate: "desc" }, take: 100 }),
    prisma.currentExpense.findMany({ where: { ...where, status: CurrentExpenseStatus.PENDING_AUTHORIZATION, shiftId: { not: null } }, include: { category: true, creditor: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, shift: true } }, applications: { where: { payment: { status: { not: PaymentStatus.VOID } } }, select: { appliedAmount: true } } }, orderBy: { accrualDate: "desc" }, take: 500 }),
    prisma.payment.findMany({ where, include: { creditor: { select: { id: true, name: true } }, paymentMethod: true, fundsAccount: true, applications: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.fundsAccount.findMany({ where: { ...where, status: FundsAccountStatus.ACTIVE }, orderBy: [{ entity: "asc" }, { id: "asc" }] }),
    prisma.paymentMethod.findMany({ where: { status: PaymentMethodStatus.ACTIVE }, orderBy: { id: "asc" } }),
  ])
  return { invoices, expenses, pendingExpenses, payments, cashAccounts, methods }
}

export async function getIndicators(entity: PaymentEntity, from: Date, to: Date) {
  const [payments, cashPayments, noInvoiceExpenses, otherExpenses, pendingStatements, overdueInvoices, oldAdvances] = await Promise.all([
    prisma.payment.findMany({ where: { entity: entity, paymentDate: { gte: from, lt: to }, status: { not: PaymentStatus.VOID } }, select: { totalAmount: true, excessAuthorizedById: true } }),
    prisma.payment.aggregate({ _sum: { totalAmount: true }, where: { entity: entity, paymentDate: { gte: from, lt: to }, status: { not: PaymentStatus.VOID }, paymentMethod: { type: PaymentMethodType.CASH } } }),
    prisma.currentExpense.aggregate({ _sum: { amount: true }, where: { entity: entity, accrualDate: { gte: from, lt: to }, receipt: ExpenseReceiptType.NO_RECEIPT, status: { not: CurrentExpenseStatus.VOID } } }),
    prisma.currentExpense.aggregate({ _sum: { amount: true }, where: { entity: entity, accrualDate: { gte: from, lt: to }, category: { code: "OTR" }, status: { not: CurrentExpenseStatus.VOID } } }),
    prisma.statementMovement.count({ where: { fundsAccount: { entity: entity }, direction: StatementMovementDirection.OUTFLOW, status: { not: StatementMovementStatus.RECONCILED }, valueDate: { gte: from, lt: to } } }),
    prisma.invoice.count({ where: { entity: entity, workflowStatus: { in: [InvoiceWorkflowStatus.CONFIRMED, InvoiceWorkflowStatus.PARTIALLY_CONFIRMED] }, dueDate: { lt: new Date() }, paymentStatus: { not: "PAGADA" } } }),
    prisma.advance.count({ where: { entity: entity, date: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, status: { notIn: [CurrentExpenseStatus.PAID, CurrentExpenseStatus.VOID] } } }),
  ])
  const total = sum(payments.map((payment) => decimal(payment.totalAmount)))
  const cash = decimal(cashPayments._sum?.totalAmount || 0)
  return {
    P1: { quantity: payments.filter((payment) => payment.excessAuthorizedById).length, amount: payments.filter((payment) => payment.excessAuthorizedById).reduce((totalAmount, payment) => totalAmount.plus(payment.totalAmount), decimal(0)) },
    P1c: overdueInvoices,
    P3: { amount: cash, percentage: total.isZero() ? decimal(0) : cash.div(total).mul(100) },
    P4: noInvoiceExpenses._sum?.amount || decimal(0),
    P5: pendingStatements,
    P6: otherExpenses._sum?.amount || decimal(0),
    P7: oldAdvances,
  }
}
