import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPaymentAssignment: { findFirst: vi.fn() },
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    invoice: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    expenseCategory: { findUnique: vi.fn() },
    authorizationParameter: { findFirst: vi.fn() },
    authorizationRule: { findMany: vi.fn() },
    currentExpense: { aggregate: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    creditor: { upsert: vi.fn(), findUnique: vi.fn() },
    advance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
    paymentMethod: { findMany: vi.fn(), findUnique: vi.fn() },
    fundsAccount: { findMany: vi.fn(), findUnique: vi.fn() },
    payment: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    paymentApplication: { aggregate: vi.fn() },
    paymentSequence: { upsert: vi.fn() },
    fundsMovement: { create: vi.fn() },
    statementMovement: { count: vi.fn() },
    paymentApproval: { create: vi.fn() },
    monthlyClose: { findUnique: vi.fn() },
  },
}))

import {
  PaymentDomainError,
  type CreatePaymentInput,
  authorizeAdvance,
  authorizeExpense,
  deleteCurrentExpense,
  createAdvance,
  createPayment,
  createExpenseFromShift,
  createExpense,
  createPaymentSchema,
  authorizeAdvanceSchema,
  authorizeExpenseSchema,
  ensureCreditorForSupplier,
  getIndicators,
  serializePaymentError,
  getPaymentDashboard,
  requireAmountAuthorization,
  requirePaymentFunction,
  userHasPaymentFunction,
} from "@/lib/payments"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

function makePaymentTransaction() {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    monthlyClose: { findUnique: vi.fn().mockResolvedValue(null) },
    userPaymentAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
    paymentMethod: {
      findUnique: vi.fn().mockResolvedValue({
        id: "MP-TRANSF",
        status: "ACTIVE",
        requiresAccount: true,
        type: "BANK_TRANSFER",
        transactionLimit: null,
      }),
    },
    fundsAccount: {
      findUnique: vi.fn().mockResolvedValue({
        id: "BCO-OBR-01",
        status: "ACTIVE",
        entity: "BAKERY",
        type: "BANK",
        theoreticalBalance: new Prisma.Decimal(500),
      }),
      update: vi.fn().mockResolvedValue({ id: "BCO-OBR-01" }),
    },
    creditor: {
      findUnique: vi.fn().mockResolvedValue({ id: "acr-1", status: "ACTIVE", type: "SERVICES" }),
    },
    invoice: {
      findUnique: vi.fn().mockResolvedValue({
        id: "fac-1",
        entity: "BAKERY",
        creditorId: "acr-1",
        workflowStatus: "CONFIRMED",
        confirmedAmount: new Prisma.Decimal(100),
        withheldAmount: new Prisma.Decimal(0),
      }),
      update: vi.fn().mockResolvedValue({ id: "fac-1", paymentStatus: "PAGADA" }),
    },
    currentExpense: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "expense-1", status: "PAID" }),
    },
    advance: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "advance-1", status: "PAID" }),
    },
    paymentApplication: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { appliedAmount: 0 } }),
    },
    paymentSequence: { upsert: vi.fn().mockResolvedValue({ lastNumber: 42 }) },
    payment: {
      create: vi.fn().mockResolvedValue({ id: "payment-1", applications: [] }),
    },
    fundsMovement: { create: vi.fn().mockResolvedValue({ id: "movement-1" }) },
    paymentApproval: { create: vi.fn().mockResolvedValue({ id: "approval-1" }) },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  }

  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction))
  return transaction
}

function makePaymentInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    entity: "BAKERY",
    paymentDate: "2026-08-23",
    paymentMethodId: "MP-TRANSF",
    fundsAccountId: "BCO-OBR-01",
    creditorId: "acr-1",
    applications: [{ destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 10 }],
    ...overrides,
  }
}

describe("payment module rules", () => {
  beforeEach(() => vi.clearAllMocks())

  it("normalizes legacy authorization decision fields", () => {
    expect(authorizeAdvanceSchema.parse({ authorizerId: "user-1", aprobar: true })).toEqual({ authorizerId: "user-1", approve: true })
    expect(authorizeExpenseSchema.parse({ authorizerId: "user-1", aprobar: false, rejectionReason: "Motivo" })).toEqual({ authorizerId: "user-1", approve: false, rejectionReason: "Motivo" })
  })

  it("requires at least one application when creating a payment", () => {
    const result = createPaymentSchema.safeParse({
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [],
    })
    expect(result.success).toBe(false)
  })

  it("accepts payments with multiple explicit applications", () => {
    const result = createPaymentSchema.safeParse({
      entity: "COFFEE_SHOP",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-CAF-01",
      creditorId: "acr-1",
      applications: [
        { destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 40 },
        { destinationType: "INVOICE", destinationId: "fac-2", appliedAmount: 60 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("serializes validation and unexpected errors", () => {
    const validation = createPaymentSchema.safeParse({ entity: "BAKERY", applications: [] })

    expect(serializePaymentError(validation.error)).toMatchObject({ code: "INVALID_INPUT", status: 400 })
    expect(serializePaymentError(new Error("database unavailable"))).toEqual({
      error: "Error interno del módulo de pagos",
      code: "PAYMENT_ERROR",
      status: 500,
    })
  })

  it("honors explicit assignments and keeps the transitional role fallback narrow", async () => {
    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    await expect(userHasPaymentFunction("user-1", "ADMINISTER", "BAKERY", "EMPLEADO")).resolves.toBe(true)

    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue(null)
    await expect(userHasPaymentFunction("user-1", "RECONCILE", "BAKERY", "SOCIO")).resolves.toBe(true)
    await expect(userHasPaymentFunction("user-1", "ADMINISTER", "BAKERY", "SOCIO")).resolves.toBe(false)
    await expect(userHasPaymentFunction("user-1", "ADMINISTER", "BAKERY", "EMPLEADO")).resolves.toBe(false)
  })

  it("rejects forbidden payment functions and missing authorization matrices", async () => {
    await expect(requirePaymentFunction("user-1", "EXECUTE", "BAKERY", "EMPLEADO")).rejects.toMatchObject({
      code: "PAYMENT_FORBIDDEN",
      status: 403,
    })

    vi.mocked(prisma.authorizationRule.findMany).mockResolvedValue([])
    await expect(requireAmountAuthorization("user-1", "ADMIN", "BAKERY", 100)).rejects.toMatchObject({
      code: "AUTHORIZATION_MATRIX_NOT_CONFIGURED",
    })

    vi.mocked(prisma.authorizationRule.findMany).mockResolvedValue([{ requiredFunction: "AUTHORIZE" }] as any)
    await expect(requireAmountAuthorization("admin-1", "ADMIN", "BAKERY", "100")).resolves.toBeUndefined()
  })

  it("upserts a provider creditor with a stable code", async () => {
    vi.mocked(prisma.creditor.upsert).mockResolvedValue({ id: "creditor-1" } as any)

    await expect(ensureCreditorForSupplier(prisma, {
      id: "provider-12345678",
      legalName: "Proveedor",
      taxId: "B12345678",
    })).resolves.toMatchObject({ id: "creditor-1" })
    expect(prisma.creditor.upsert).toHaveBeenCalledWith({
      where: { supplierId: "provider-12345678" },
      update: { name: "Proveedor", taxId: "B12345678", status: "ACTIVE" },
      create: {
        code: "PRV-12345678",
        type: "MERCHANDISE_SUPPLIER",
        name: "Proveedor",
        taxId: "B12345678",
        supplierId: "provider-12345678",
        createdById: null,
      },
    })
  })

  it("rejects generic one-word concepts", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat", code: "SUM", active: true } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      concept: "Varios",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "GENERIC_CONCEPT" })
  })

  it("allows expenses without an invoice in any category and without limits", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat", code: "SUM", active: true } as any)
    vi.mocked(prisma.creditor.findUnique).mockResolvedValue({ id: "acr-1", type: "SERVICES", status: "ACTIVE" } as any)
    vi.mocked(prisma.currentExpense.create).mockResolvedValue({ id: "gasto-1" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      concept: "Agua urgente",
      accrualDate: "2026-08-23",
      amount: 999999,
      creditorId: "acr-1",
      receipt: "NO_RECEIPT",
    })).resolves.toMatchObject({ id: "gasto-1" })
  })

  it("allows recording staff overtime without a creditor", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat-personal", code: "PER", active: true } as any)
    vi.mocked(prisma.currentExpense.create).mockResolvedValue({ id: "gasto-personal-1" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat-personal",
      concept: "Horas extras empleado",
      accrualDate: "2026-08-23",
      amount: 125.5,
      receipt: "NO_RECEIPT",
    })).resolves.toMatchObject({ id: "gasto-personal-1" })
  })

  it("validates categories, dates and required creditors before creating an expense", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue(null)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "missing",
      concept: "Compra de agua",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "CATEGORY_UNAVAILABLE" })

    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat", code: "SUM", active: true } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      concept: "Compra de agua",
      accrualDate: "invalid-date",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ message: "Fecha no válida" })
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      concept: "Compra de agua",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "CREDITOR_REQUIRED" })
  })

  it("requires direction for other expenses and rejects unavailable merchandise creditors", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat-otr", code: "OTR", active: true } as any)
    vi.mocked(prisma.userPaymentAssignment.findFirst)
      .mockResolvedValueOnce({ id: "request-assignment" } as any)
      .mockResolvedValueOnce(null)
    await expect(createExpense({ id: "employee-1", role: "EMPLEADO" }, {
      entity: "BAKERY",
      categoryId: "cat-otr",
      creditorId: "creditor-1",
      concept: "Servicio externo",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "OTHER_CATEGORY_REQUIRES_DIRECTION" })

    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat", code: "SUM", active: true } as any)
    vi.mocked(prisma.creditor.findUnique).mockResolvedValue(null)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      creditorId: "creditor-1",
      concept: "Compra de agua",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "CREDITOR_UNAVAILABLE" })

    vi.mocked(prisma.creditor.findUnique).mockResolvedValue({ type: "MERCHANDISE_SUPPLIER", status: "ACTIVE" } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      categoryId: "cat",
      creditorId: "creditor-1",
      concept: "Compra de harina",
      accrualDate: "2026-08-23",
      amount: 10,
      receipt: "INVOICE",
    })).rejects.toMatchObject({ code: "MERCHANDISE_CREDITOR_REQUIRES_INVOICE" })
  })

  it("creates a minor purchase with its dedicated creditor", async () => {
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat-men", code: "MEN", active: true } as any)
    vi.mocked(prisma.creditor.upsert).mockResolvedValue({ id: "minor-creditor" } as any)
    vi.mocked(prisma.currentExpense.create).mockResolvedValue({ id: "minor-expense" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entity: "COFFEE_SHOP",
      categoryId: "cat-men",
      concept: "Compra menor urgente",
      accrualDate: "2026-08-23",
      amount: 25,
      receipt: "NO_RECEIPT",
    })).resolves.toMatchObject({ id: "minor-expense" })
    expect(prisma.creditor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: "MEN-CAFETERIA" },
      create: expect.objectContaining({ type: "OTHER", defaultEntity: "COFFEE_SHOP" }),
    }))
  })

  it("requires an open shift and recalculates its fund for shift expenses", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValueOnce(null)
    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "missing-shift", {
      categoryId: "cat-personal",
      concept: "Horas extra turno",
      accrualDate: "2026-08-23",
      amount: 25,
    })).rejects.toMatchObject({ code: "SHIFT_NOT_FOUND" })

    vi.mocked(prisma.shift.findUnique).mockResolvedValueOnce({ id: "shift-1", status: "CERRADO", createdById: "user-1" } as any)
    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "shift-1", {
      categoryId: "cat-personal",
      concept: "Horas extra turno",
      accrualDate: "2026-08-23",
      amount: 25,
    })).rejects.toMatchObject({ code: "SHIFT_NOT_OPEN" })

    vi.mocked(prisma.shift.findUnique)
      .mockResolvedValueOnce({ id: "shift-1", status: "ABIERTO", createdById: "user-1" } as any)
      .mockResolvedValueOnce({ openingFund: 500 } as any)
    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    vi.mocked(prisma.expenseCategory.findUnique).mockResolvedValue({ id: "cat-personal", code: "PER", active: true } as any)
    vi.mocked(prisma.currentExpense.create).mockResolvedValue({ id: "shift-expense" } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 10 } } as any)
    vi.mocked(prisma.currentExpense.aggregate).mockResolvedValue({ _sum: { amount: 20 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", closingFund: 470 } as any)

    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "shift-1", {
      categoryId: "cat-personal",
      concept: "Horas extra turno",
      accrualDate: "2026-08-23",
      amount: 25,
    })).resolves.toMatchObject({ id: "shift-expense" })
    expect(prisma.currentExpense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shiftId: "shift-1", entity: "COFFEE_SHOP" }),
    }))
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { closingFund: 470 } })
  })

  it("creates and authorizes an advance for a service creditor", async () => {
    vi.mocked(prisma.creditor.findUnique).mockResolvedValue({ id: "creditor-1", type: "SERVICES", status: "ACTIVE" } as any)
    vi.mocked(prisma.advance.create).mockResolvedValue({ id: "advance-1" } as any)

    await expect(createAdvance({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      creditorId: "creditor-1",
      concept: "Anticipo de servicio",
      date: "2026-08-23",
      amount: 100,
    })).resolves.toMatchObject({ id: "advance-1" })
    expect(prisma.advance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING_AUTHORIZATION", requestedById: "user-1" }),
    }))

    vi.mocked(prisma.advance.findUnique).mockResolvedValue({
      id: "advance-1",
      entity: "BAKERY",
      requestedById: "requester-1",
      date: new Date("2026-08-23"),
      status: "PENDING_AUTHORIZATION",
      amount: 100,
    } as any)
    vi.mocked(prisma.authorizationRule.findMany).mockResolvedValue([{ requiredFunction: "AUTHORIZE" }] as any)
    vi.mocked(prisma.advance.update).mockResolvedValue({ id: "advance-1", status: "AUTHORIZED" } as any)

    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      authorizerId: "authorizer-1",
      approve: true,
    })).resolves.toMatchObject({ status: "AUTHORIZED" })
    expect(prisma.advance.update).toHaveBeenCalledWith({
      where: { id: "advance-1" },
      data: { status: "AUTHORIZED", authorizedById: "authorizer-1" },
    })

    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      authorizerId: "authorizer-1",
      approve: false,
    })).resolves.toMatchObject({ status: "AUTHORIZED" })
    expect(prisma.advance.update).toHaveBeenLastCalledWith({
      where: { id: "advance-1" },
      data: { status: "VOID", authorizedById: "authorizer-1" },
    })
  })

  it("rejects invalid advance creation and authorization states", async () => {
    vi.mocked(prisma.creditor.findUnique).mockResolvedValue({ id: "creditor-1", type: "MERCHANDISE_SUPPLIER", status: "ACTIVE" } as any)
    await expect(createAdvance({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      creditorId: "creditor-1",
      concept: "Anticipo mercancía",
      date: "2026-08-23",
      amount: 100,
    })).rejects.toMatchObject({ code: "MERCHANDISE_CREDITOR_REQUIRES_INVOICE" })

    vi.mocked(prisma.advance.findUnique).mockResolvedValue(null)
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "missing", {
      authorizerId: "authorizer-1",
      approve: true,
    })).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" })

      vi.mocked(prisma.advance.findUnique).mockResolvedValue({
      id: "advance-1",
      entity: "BAKERY",
      requestedById: "authorizer-1",
      date: new Date("2026-08-23"),
      status: "PAID",
      amount: 100,
    } as any)
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      authorizerId: "other-user",
      approve: true,
    })).rejects.toMatchObject({ code: "AUTHORIZER_MISMATCH" })
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      authorizerId: "authorizer-1",
      approve: true,
    })).rejects.toMatchObject({ code: "SEGREGATION_VIOLATION" })
  })

  it("prevents the requester from authorizing their own expense", async () => {
    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue({
      id: "gasto-1",
      entity: "BAKERY",
      requesterId: "user-1",
      accrualDate: new Date("2026-08-23"),
      status: "PENDING_AUTHORIZATION",
      category: { code: "SUM" },
    } as any)
    await expect(authorizeExpense({ id: "user-1", role: "ADMIN" }, "gasto-1", { authorizerId: "user-1", approve: true })).rejects.toMatchObject({ code: "SEGREGATION_VIOLATION" })
  })

  it("allows rejecting an expense without an authorization matrix", async () => {
    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue({
      id: "gasto-1",
      entity: "COFFEE_SHOP",
      requesterId: "employee-1",
      accrualDate: new Date("2026-08-23"),
      status: "PENDING_AUTHORIZATION",
      amount: 125.5,
      category: { code: "PER" },
    } as any)
    vi.mocked(prisma.currentExpense.update).mockResolvedValue({ id: "gasto-1", status: "RECHAZADO" } as any)

    await expect(authorizeExpense({ id: "partner-1", role: "ADMIN" }, "gasto-1", {
      authorizerId: "partner-1",
      approve: false,
      rejectionReason: "Revisar el importe",
    })).resolves.toMatchObject({ id: "gasto-1", status: "RECHAZADO" })
    expect(prisma.authorizationRule.findMany).not.toHaveBeenCalled()
  })

  it("voids a shift expense and recalculates the fund", async () => {
    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue({
      id: "gasto-1",
      entity: "COFFEE_SHOP",
      shiftId: "shift-1",
      accrualDate: new Date("2026-08-23"),
      status: "PENDING_AUTHORIZATION",
      amount: 125.5,
      applications: [],
    } as any)
    vi.mocked(prisma.currentExpense.update).mockResolvedValue({ id: "gasto-1", status: "VOID" } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ openingFund: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 10 } } as any)
    vi.mocked(prisma.currentExpense.aggregate).mockResolvedValue({ _sum: { amount: 25 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", closingFund: 465 } as any)

    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).resolves.toMatchObject({ status: "VOID" })
    expect(prisma.currentExpense.update).toHaveBeenCalledWith({ where: { id: "gasto-1" }, data: { status: "VOID" } })
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { closingFund: 465 } })
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "GASTO_ANULADO", recordId: "gasto-1" }),
    }))
  })

  it("prevents voiding an expense with applied payments", async () => {
    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue({
      id: "gasto-1",
      entity: "COFFEE_SHOP",
      shiftId: "shift-1",
      accrualDate: new Date("2026-08-23"),
      status: "PAID",
      amount: 125.5,
      applications: [{ id: "application-1" }],
    } as any)

    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({ code: "EXPENSE_HAS_PAYMENTS" })
    expect(prisma.currentExpense.update).not.toHaveBeenCalled()
  })

  it("protects current-expense deletion and reports missing shift expenses", async () => {
    await expect(deleteCurrentExpense({ id: "employee-1", role: "EMPLEADO" }, "gasto-1")).rejects.toMatchObject({
      code: "PAYMENT_FORBIDDEN",
    })

    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue(null)
    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    })

    vi.mocked(prisma.currentExpense.findUnique).mockResolvedValue({
      id: "gasto-1",
      shiftId: null,
      status: "PENDING_AUTHORIZATION",
      applications: [],
    } as any)
    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("includes the requester name in the payment dashboard", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.currentExpense.findMany).mockResolvedValue([{
      id: "gasto-1",
      requester: { id: "user-1", name: "Ana García", email: "ana@example.com" },
    }] as any)
    vi.mocked(prisma.payment.findMany).mockResolvedValue([])
    vi.mocked(prisma.fundsAccount.findMany).mockResolvedValue([])
    vi.mocked(prisma.paymentMethod.findMany).mockResolvedValue([])

    const dashboard = await getPaymentDashboard("BAKERY")

    expect(prisma.currentExpense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ entity: "BAKERY", shiftId: { not: null } }),
      include: expect.objectContaining({
        requester: { select: { id: true, name: true, email: true } },
      }),
    }))
    expect(dashboard.expenses[0]).toMatchObject({ requester: { name: "Ana García" } })
  })

  it("calculates payment indicators from non-annulled movements and documents", async () => {
    const from = new Date("2026-08-01T00:00:00.000Z")
    const to = new Date("2026-09-01T00:00:00.000Z")
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { totalAmount: new Prisma.Decimal(100), excessAuthorizedById: "authorizer-1" },
      { totalAmount: new Prisma.Decimal(50), excessAuthorizedById: null },
    ] as any)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(25) } } as any)
    vi.mocked(prisma.currentExpense.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(12) } } as any)
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(8) } } as any)
    vi.mocked(prisma.statementMovement.count).mockResolvedValue(3)
    vi.mocked(prisma.invoice.count).mockResolvedValue(4)
    vi.mocked(prisma.advance.count).mockResolvedValue(5)

    const indicators = await getIndicators("BAKERY", from, to)

    expect(indicators.P1.quantity).toBe(1)
    expect(indicators.P1.amount.toString()).toBe("100")
    expect(indicators.P1c).toBe(4)
    expect(indicators.P3.amount.toString()).toBe("25")
    expect(indicators.P3.percentage.toString()).toBe("16.666666666666666667")
    expect(indicators.P4.toString()).toBe("12")
    expect(indicators.P5).toBe(3)
    expect(indicators.P6.toString()).toBe("8")
    expect(indicators.P7).toBe(5)
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ entity: "BAKERY", paymentDate: { gte: from, lt: to } }),
    }))
  })

  it("allows the transitional ADMIN fallback while functions are assigned", async () => {
    vi.mocked(prisma.userPaymentAssignment.findFirst).mockResolvedValue(null)
    await expect(userHasPaymentFunction("admin", "EXECUTE", "BAKERY", "ADMIN")).resolves.toBe(true)
  })

  it("blocks duplicate applications within one operation", async () => {
    vi.mocked(prisma.paymentMethod.findUnique).mockResolvedValue({ id: "MP-TRANSF", status: "ACTIVE", requiresAccount: true, type: "BANK_TRANSFER", transactionLimit: null } as any)
    vi.mocked(prisma.fundsAccount.findUnique).mockResolvedValue({ id: "BCO-OBR-01", status: "ACTIVE", entity: "BAKERY", type: "BANK" } as any)
    vi.mocked((prisma as any).creditor.findUnique).mockResolvedValue({ id: "acr-1", status: "ACTIVE" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
      userPaymentAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
      monthlyClose: { findUnique: vi.fn().mockResolvedValue(null) },
      paymentMethod: prisma.paymentMethod,
      fundsAccount: prisma.fundsAccount,
      creditor: (prisma as any).creditor,
    }))

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [
        { destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 10 },
        { destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 5 },
      ],
    })).rejects.toMatchObject({ code: "DUPLICATE_APPLICATION" })
  })

  it("creates a payment, records the fund movement and closes a fully paid invoice", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.paymentApplication.aggregate)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 100 } } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [{ destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 100 }],
    })).resolves.toMatchObject({ id: "payment-1" })

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2)
    expect(transaction.paymentSequence.upsert).toHaveBeenCalledWith({
      where: { entity: "BAKERY" },
      create: { entity: "BAKERY", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    })
    expect(transaction.fundsMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fundsAccountId: "BCO-OBR-01",
      type: "PAYMENT_OUTFLOW",
        sourceId: "payment-1",
      }),
    }))
    expect(transaction.fundsAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "BCO-OBR-01" },
    }))
    expect(transaction.invoice.update).toHaveBeenCalledWith({
      where: { id: "fac-1" },
      data: { paymentStatus: "PAGADA", paidAmount: new Prisma.Decimal(100) },
    })
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PAGO_CREADO", recordId: "payment-1" }),
    }))
  })

  it("applies payments to an authorized expense and advance", async () => {
    const expenseTransaction = makePaymentTransaction()
    vi.mocked(expenseTransaction.currentExpense.findUnique).mockResolvedValue({
      id: "expense-1",
      entity: "BAKERY",
      creditorId: "acr-1",
      status: "AUTHORIZED",
      amount: new Prisma.Decimal(50),
      category: { code: "SUM" },
    } as any)
    vi.mocked(expenseTransaction.paymentApplication.aggregate)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 50 } } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [{ destinationType: "EXPENSE", destinationId: "expense-1", appliedAmount: 50 }],
    })).resolves.toMatchObject({ id: "payment-1" })
    expect(expenseTransaction.currentExpense.update).toHaveBeenCalledWith({
      where: { id: "expense-1" },
      data: { status: "PAID" },
    })

    const advanceTransaction = makePaymentTransaction()
    vi.mocked(advanceTransaction.advance.findUnique).mockResolvedValue({
      id: "advance-1",
      entity: "BAKERY",
      creditorId: "acr-1",
      status: "AUTHORIZED",
      amount: new Prisma.Decimal(50),
      appliedAmount: new Prisma.Decimal(0),
    } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [{ destinationType: "ADVANCE", destinationId: "advance-1", appliedAmount: 50 }],
    })).resolves.toMatchObject({ id: "payment-1" })
    expect(advanceTransaction.advance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "advance-1" },
      data: expect.objectContaining({ status: "PAID" }),
    }))
    const advanceUpdate = vi.mocked(advanceTransaction.advance.update).mock.calls[0]?.[0] as any
    expect(advanceUpdate.data.appliedAmount.increment.toString()).toBe("50")
  })

  it("validates the invoice target before applying a payment", async () => {
    const transaction = makePaymentTransaction()
    const invoice = {
      id: "fac-1",
      entity: "BAKERY",
      creditorId: "acr-1",
      workflowStatus: "CONFIRMED",
      confirmedAmount: new Prisma.Decimal(10),
      withheldAmount: new Prisma.Decimal(0),
    }

    const cases = [
      [null, "DOCUMENT_NOT_FOUND"],
      [{ ...invoice, entity: "COFFEE_SHOP" }, "ENTITY_MISMATCH"],
      [{ ...invoice, creditorId: "other-creditor" }, "CREDITOR_MISMATCH"],
      [{ ...invoice, workflowStatus: "DRAFT" }, "DOCUMENT_NOT_PAYABLE"],
      [{ ...invoice, confirmedAmount: null }, "MISSING_CONFORMED_AMOUNT"],
      [{ ...invoice, confirmedAmount: new Prisma.Decimal(5) }, "AMOUNT_OVER_PENDING"],
    ] as const

    for (const [target, code] of cases) {
      vi.mocked(transaction.invoice.findUnique).mockResolvedValueOnce(target as any)
      await expect(createPayment({ id: "user-1", role: "ADMIN" }, makePaymentInput())).rejects.toMatchObject({ code })
    }
  })

  it("rejects caller-supplied excess approvals", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.userPaymentAssignment.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    vi.mocked(transaction.paymentApplication.aggregate)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { appliedAmount: 120 } } as any)

    await expect(createPayment({ id: "executor-1", role: "ADMIN" }, makePaymentInput({
      applications: [{ destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 120 }],
      excessAuthorizedById: "authorizer-1",
      excessReason: "Ajuste aprobado por dirección",
    }))).rejects.toMatchObject({ code: "EXCESS_APPROVAL_REQUIRED" })
    expect(transaction.payment.create).not.toHaveBeenCalled()
  })

  it("rejects unavailable payment methods and malformed payment dates", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.paymentMethod.findUnique).mockResolvedValue(null)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "2026-08-23",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [{ destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 10 }],
    })).rejects.toMatchObject({ code: "PAYMENT_METHOD_UNAVAILABLE" })

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entity: "BAKERY",
      paymentDate: "invalid-date",
      paymentMethodId: "MP-TRANSF",
      fundsAccountId: "BCO-OBR-01",
      creditorId: "acr-1",
      applications: [{ destinationType: "INVOICE", destinationId: "fac-1", appliedAmount: 10 }],
    })).rejects.toMatchObject({ message: "Fecha no válida" })
  })

  it("serializes domain errors with code and status", () => {
    const result = serializePaymentError(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))
    expect(result).toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN", status: 403 })
  })
})
