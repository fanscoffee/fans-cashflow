import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asignacionPagoUsuario: { findFirst: vi.fn() },
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    factura: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    categoriaGasto: { findUnique: vi.fn() },
    parametroAutorizacion: { findFirst: vi.fn() },
    reglaAutorizacion: { findMany: vi.fn() },
    gastoCorriente: { aggregate: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    acreedor: { upsert: vi.fn(), findUnique: vi.fn() },
    anticipo: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    eventoAuditoria: { create: vi.fn() },
    $transaction: vi.fn(),
    medioPago: { findMany: vi.fn(), findUnique: vi.fn() },
    cuentaFondos: { findMany: vi.fn(), findUnique: vi.fn() },
    pago: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    pagoAplicacion: { aggregate: vi.fn() },
    secuenciaPago: { upsert: vi.fn() },
    movimientoFondos: { create: vi.fn() },
    movimientoExtracto: { count: vi.fn() },
    aprobacionPago: { create: vi.fn() },
    cierreMensual: { findUnique: vi.fn() },
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
  ensureAcreedorForProveedor,
  getIndicators,
  serializePaymentError,
  getPaymentDashboard,
  requireAmountAuthorization,
  requirePaymentFunction,
  userHasPaymentFunction,
} from "@/lib/pagos"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

function makePaymentTransaction() {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    cierreMensual: { findUnique: vi.fn().mockResolvedValue(null) },
    asignacionPagoUsuario: { findFirst: vi.fn().mockResolvedValue(null) },
    medioPago: {
      findUnique: vi.fn().mockResolvedValue({
        id: "MP-TRANSF",
        estado: "ACTIVO",
        requiereCuenta: true,
        tipo: "TRANSFERENCIA",
        limiteOperacion: null,
      }),
    },
    cuentaFondos: {
      findUnique: vi.fn().mockResolvedValue({
        id: "BCO-OBR-01",
        estado: "ACTIVA",
        entidad: "OBRADOR",
        tipo: "BANCO",
        saldoTeorico: new Prisma.Decimal(500),
      }),
      update: vi.fn().mockResolvedValue({ id: "BCO-OBR-01" }),
    },
    acreedor: {
      findUnique: vi.fn().mockResolvedValue({ id: "acr-1", estado: "ACTIVO", tipo: "SERVICIOS" }),
    },
    factura: {
      findUnique: vi.fn().mockResolvedValue({
        id: "fac-1",
        entidad: "OBRADOR",
        acreedorId: "acr-1",
        estadoCircuito: "CONFORMADA",
        importeConformado: new Prisma.Decimal(100),
        importeRetenido: new Prisma.Decimal(0),
      }),
      update: vi.fn().mockResolvedValue({ id: "fac-1", estadoPago: "PAGADA" }),
    },
    gastoCorriente: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "expense-1", estado: "PAGADO" }),
    },
    anticipo: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "advance-1", estado: "PAGADO" }),
    },
    pagoAplicacion: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { importeAplicado: 0 } }),
    },
    secuenciaPago: { upsert: vi.fn().mockResolvedValue({ ultimoNumero: 42 }) },
    pago: {
      create: vi.fn().mockResolvedValue({ id: "payment-1", aplicaciones: [] }),
    },
    movimientoFondos: { create: vi.fn().mockResolvedValue({ id: "movement-1" }) },
    aprobacionPago: { create: vi.fn().mockResolvedValue({ id: "approval-1" }) },
    eventoAuditoria: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  }

  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction))
  return transaction
}

function makePaymentInput(overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput {
  return {
    entidad: "OBRADOR",
    fechaPago: "2026-08-23",
    medioPagoId: "MP-TRANSF",
    cuentaFondosId: "BCO-OBR-01",
    acreedorId: "acr-1",
    aplicaciones: [{ tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 10 }],
    ...overrides,
  }
}

describe("reglas del módulo de pagos", () => {
  beforeEach(() => vi.clearAllMocks())

  it("exige al menos una aplicación al crear un pago", () => {
    const result = createPaymentSchema.safeParse({
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [],
    })
    expect(result.success).toBe(false)
  })

  it("acepta pagos con varias aplicaciones explícitas", () => {
    const result = createPaymentSchema.safeParse({
      entidad: "CAFETERIA",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-CAF-01",
      acreedorId: "acr-1",
      aplicaciones: [
        { tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 40 },
        { tipoDestino: "FACTURA", destinoId: "fac-2", importeAplicado: 60 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("serializes validation and unexpected errors", () => {
    const validation = createPaymentSchema.safeParse({ entidad: "OBRADOR", aplicaciones: [] })

    expect(serializePaymentError(validation.error)).toMatchObject({ code: "INVALID_INPUT", status: 400 })
    expect(serializePaymentError(new Error("database unavailable"))).toEqual({
      error: "Error interno del módulo de pagos",
      code: "PAYMENT_ERROR",
      status: 500,
    })
  })

  it("honors explicit assignments and keeps the transitional role fallback narrow", async () => {
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    await expect(userHasPaymentFunction("user-1", "ADMINISTRAR", "OBRADOR", "EMPLEADO")).resolves.toBe(true)

    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue(null)
    await expect(userHasPaymentFunction("user-1", "CONCILIAR", "OBRADOR", "SOCIO")).resolves.toBe(true)
    await expect(userHasPaymentFunction("user-1", "ADMINISTRAR", "OBRADOR", "SOCIO")).resolves.toBe(false)
    await expect(userHasPaymentFunction("user-1", "ADMINISTRAR", "OBRADOR", "EMPLEADO")).resolves.toBe(false)
  })

  it("rejects forbidden payment functions and missing authorization matrices", async () => {
    await expect(requirePaymentFunction("user-1", "EJECUTAR", "OBRADOR", "EMPLEADO")).rejects.toMatchObject({
      code: "PAYMENT_FORBIDDEN",
      status: 403,
    })

    vi.mocked(prisma.reglaAutorizacion.findMany).mockResolvedValue([])
    await expect(requireAmountAuthorization("user-1", "ADMIN", "OBRADOR", 100)).rejects.toMatchObject({
      code: "AUTHORIZATION_MATRIX_NOT_CONFIGURED",
    })

    vi.mocked(prisma.reglaAutorizacion.findMany).mockResolvedValue([{ funcionRequerida: "AUTORIZAR" }] as any)
    await expect(requireAmountAuthorization("admin-1", "ADMIN", "OBRADOR", "100")).resolves.toBeUndefined()
  })

  it("upserts a provider creditor with a stable code", async () => {
    vi.mocked(prisma.acreedor.upsert).mockResolvedValue({ id: "creditor-1" } as any)

    await expect(ensureAcreedorForProveedor(prisma, {
      id: "provider-12345678",
      razonSocial: "Proveedor",
      cifNif: "B12345678",
    })).resolves.toMatchObject({ id: "creditor-1" })
    expect(prisma.acreedor.upsert).toHaveBeenCalledWith({
      where: { proveedorId: "provider-12345678" },
      update: { nombre: "Proveedor", nif: "B12345678", estado: "ACTIVO" },
      create: {
        codigo: "PRV-12345678",
        tipo: "PROVEEDOR_MERCANCIA",
        nombre: "Proveedor",
        nif: "B12345678",
        proveedorId: "provider-12345678",
        createdById: null,
      },
    })
  })

  it("rechaza conceptos genéricos de una sola palabra", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat", codigo: "SUM", activo: true } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      concepto: "Varios",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "GENERIC_CONCEPT" })
  })

  it("permite gastos sin factura en cualquier categoría y sin límites", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat", codigo: "SUM", activo: true } as any)
    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue({ id: "acr-1", tipo: "SERVICIOS", estado: "ACTIVO" } as any)
    vi.mocked(prisma.gastoCorriente.create).mockResolvedValue({ id: "gasto-1" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      concepto: "Agua urgente",
      fechaDevengo: "2026-08-23",
      importe: 999999,
      acreedorId: "acr-1",
      justificante: "SIN_JUSTIFICANTE",
    })).resolves.toMatchObject({ id: "gasto-1" })
  })

  it("permite registrar horas extras de Personal sin acreedor", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat-personal", codigo: "PER", activo: true } as any)
    vi.mocked(prisma.gastoCorriente.create).mockResolvedValue({ id: "gasto-personal-1" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat-personal",
      concepto: "Horas extras empleado",
      fechaDevengo: "2026-08-23",
      importe: 125.5,
      justificante: "SIN_JUSTIFICANTE",
    })).resolves.toMatchObject({ id: "gasto-personal-1" })
  })

  it("validates categories, dates and required creditors before creating an expense", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue(null)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "missing",
      concepto: "Compra de agua",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "CATEGORY_UNAVAILABLE" })

    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat", codigo: "SUM", activo: true } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      concepto: "Compra de agua",
      fechaDevengo: "invalid-date",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ message: "Fecha no válida" })
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      concepto: "Compra de agua",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "CREDITOR_REQUIRED" })
  })

  it("requires direction for other expenses and rejects unavailable merchandise creditors", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat-otr", codigo: "OTR", activo: true } as any)
    vi.mocked(prisma.asignacionPagoUsuario.findFirst)
      .mockResolvedValueOnce({ id: "request-assignment" } as any)
      .mockResolvedValueOnce(null)
    await expect(createExpense({ id: "employee-1", role: "EMPLEADO" }, {
      entidad: "OBRADOR",
      categoriaId: "cat-otr",
      acreedorId: "creditor-1",
      concepto: "Servicio externo",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "OTHER_CATEGORY_REQUIRES_DIRECTION" })

    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat", codigo: "SUM", activo: true } as any)
    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue(null)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      acreedorId: "creditor-1",
      concepto: "Compra de agua",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "CREDITOR_UNAVAILABLE" })

    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue({ tipo: "PROVEEDOR_MERCANCIA", estado: "ACTIVO" } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      acreedorId: "creditor-1",
      concepto: "Compra de harina",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "FACTURA",
    })).rejects.toMatchObject({ code: "MERCHANDISE_CREDITOR_REQUIRES_INVOICE" })
  })

  it("creates a minor purchase with its dedicated creditor", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat-men", codigo: "MEN", activo: true } as any)
    vi.mocked(prisma.acreedor.upsert).mockResolvedValue({ id: "minor-creditor" } as any)
    vi.mocked(prisma.gastoCorriente.create).mockResolvedValue({ id: "minor-expense" } as any)

    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "CAFETERIA",
      categoriaId: "cat-men",
      concepto: "Compra menor urgente",
      fechaDevengo: "2026-08-23",
      importe: 25,
      justificante: "SIN_JUSTIFICANTE",
    })).resolves.toMatchObject({ id: "minor-expense" })
    expect(prisma.acreedor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { codigo: "MEN-CAFETERIA" },
      create: expect.objectContaining({ tipo: "OTROS", entidadHabitual: "CAFETERIA" }),
    }))
  })

  it("requires an open shift and recalculates its fund for shift expenses", async () => {
    vi.mocked(prisma.shift.findUnique).mockResolvedValueOnce(null)
    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "missing-shift", {
      categoriaId: "cat-personal",
      concepto: "Horas extra turno",
      fechaDevengo: "2026-08-23",
      importe: 25,
    })).rejects.toMatchObject({ code: "SHIFT_NOT_FOUND" })

    vi.mocked(prisma.shift.findUnique).mockResolvedValueOnce({ id: "shift-1", status: "CERRADO", createdById: "user-1" } as any)
    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "shift-1", {
      categoriaId: "cat-personal",
      concepto: "Horas extra turno",
      fechaDevengo: "2026-08-23",
      importe: 25,
    })).rejects.toMatchObject({ code: "SHIFT_NOT_OPEN" })

    vi.mocked(prisma.shift.findUnique)
      .mockResolvedValueOnce({ id: "shift-1", status: "ABIERTO", createdById: "user-1" } as any)
      .mockResolvedValueOnce({ fondoInicial: 500 } as any)
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat-personal", codigo: "PER", activo: true } as any)
    vi.mocked(prisma.gastoCorriente.create).mockResolvedValue({ id: "shift-expense" } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 10 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 20 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", fondoFinal: 470 } as any)

    await expect(createExpenseFromShift({ id: "user-1", role: "EMPLEADO" }, "shift-1", {
      categoriaId: "cat-personal",
      concepto: "Horas extra turno",
      fechaDevengo: "2026-08-23",
      importe: 25,
    })).resolves.toMatchObject({ id: "shift-expense" })
    expect(prisma.gastoCorriente.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shiftId: "shift-1", entidad: "CAFETERIA" }),
    }))
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { fondoFinal: 470 } })
  })

  it("creates and authorizes an advance for a service creditor", async () => {
    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue({ id: "creditor-1", tipo: "SERVICIOS", estado: "ACTIVO" } as any)
    vi.mocked(prisma.anticipo.create).mockResolvedValue({ id: "advance-1" } as any)

    await expect(createAdvance({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      acreedorId: "creditor-1",
      concepto: "Anticipo de servicio",
      fecha: "2026-08-23",
      importe: 100,
    })).resolves.toMatchObject({ id: "advance-1" })
    expect(prisma.anticipo.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ estado: "PENDIENTE_AUTORIZACION", solicitadoPorId: "user-1" }),
    }))

    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({
      id: "advance-1",
      entidad: "OBRADOR",
      solicitadoPorId: "requester-1",
      fecha: new Date("2026-08-23"),
      estado: "PENDIENTE_AUTORIZACION",
      importe: 100,
    } as any)
    vi.mocked(prisma.reglaAutorizacion.findMany).mockResolvedValue([{ funcionRequerida: "AUTORIZAR" }] as any)
    vi.mocked(prisma.anticipo.update).mockResolvedValue({ id: "advance-1", estado: "AUTORIZADO" } as any)

    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      autorizadorId: "authorizer-1",
      aprobar: true,
    })).resolves.toMatchObject({ estado: "AUTORIZADO" })
    expect(prisma.anticipo.update).toHaveBeenCalledWith({
      where: { id: "advance-1" },
      data: { estado: "AUTORIZADO", autorizadoPorId: "authorizer-1" },
    })

    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      autorizadorId: "authorizer-1",
      aprobar: false,
    })).resolves.toMatchObject({ estado: "AUTORIZADO" })
    expect(prisma.anticipo.update).toHaveBeenLastCalledWith({
      where: { id: "advance-1" },
      data: { estado: "ANULADO", autorizadoPorId: "authorizer-1" },
    })
  })

  it("rejects invalid advance creation and authorization states", async () => {
    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue({ id: "creditor-1", tipo: "PROVEEDOR_MERCANCIA", estado: "ACTIVO" } as any)
    await expect(createAdvance({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      acreedorId: "creditor-1",
      concepto: "Anticipo mercancía",
      fecha: "2026-08-23",
      importe: 100,
    })).rejects.toMatchObject({ code: "MERCHANDISE_CREDITOR_REQUIRES_INVOICE" })

    vi.mocked(prisma.anticipo.findUnique).mockResolvedValue(null)
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "missing", {
      autorizadorId: "authorizer-1",
      aprobar: true,
    })).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" })

      vi.mocked(prisma.anticipo.findUnique).mockResolvedValue({
      id: "advance-1",
      entidad: "OBRADOR",
      solicitadoPorId: "authorizer-1",
      fecha: new Date("2026-08-23"),
      estado: "PAGADO",
      importe: 100,
    } as any)
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      autorizadorId: "other-user",
      aprobar: true,
    })).rejects.toMatchObject({ code: "AUTHORIZER_MISMATCH" })
    await expect(authorizeAdvance({ id: "authorizer-1", role: "ADMIN" }, "advance-1", {
      autorizadorId: "authorizer-1",
      aprobar: true,
    })).rejects.toMatchObject({ code: "SEGREGATION_VIOLATION" })
  })

  it("impide que el solicitante autorice su propio gasto", async () => {
    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      entidad: "OBRADOR",
      solicitanteId: "user-1",
      fechaDevengo: new Date("2026-08-23"),
      estado: "PENDIENTE_AUTORIZACION",
      categoria: { codigo: "SUM" },
    } as any)
    await expect(authorizeExpense({ id: "user-1", role: "ADMIN" }, "gasto-1", { autorizadorId: "user-1", aprobar: true })).rejects.toMatchObject({ code: "SEGREGATION_VIOLATION" })
  })

  it("permite rechazar un gasto sin matriz de autorización", async () => {
    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      entidad: "CAFETERIA",
      solicitanteId: "employee-1",
      fechaDevengo: new Date("2026-08-23"),
      estado: "PENDIENTE_AUTORIZACION",
      importe: 125.5,
      categoria: { codigo: "PER" },
    } as any)
    vi.mocked(prisma.gastoCorriente.update).mockResolvedValue({ id: "gasto-1", estado: "RECHAZADO" } as any)

    await expect(authorizeExpense({ id: "partner-1", role: "ADMIN" }, "gasto-1", {
      autorizadorId: "partner-1",
      aprobar: false,
      motivoRechazo: "Revisar el importe",
    })).resolves.toMatchObject({ id: "gasto-1", estado: "RECHAZADO" })
    expect(prisma.reglaAutorizacion.findMany).not.toHaveBeenCalled()
  })

  it("anula un gasto de turno y recalcula el fondo", async () => {
    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      entidad: "CAFETERIA",
      shiftId: "shift-1",
      fechaDevengo: new Date("2026-08-23"),
      estado: "PENDIENTE_AUTORIZACION",
      importe: 125.5,
      aplicaciones: [],
    } as any)
    vi.mocked(prisma.gastoCorriente.update).mockResolvedValue({ id: "gasto-1", estado: "ANULADO" } as any)
    vi.mocked(prisma.shift.findUnique).mockResolvedValue({ fondoInicial: 500 } as any)
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { importe: 10 } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate).mockResolvedValue({ _sum: { importe: 25 } } as any)
    vi.mocked(prisma.shift.update).mockResolvedValue({ id: "shift-1", fondoFinal: 465 } as any)

    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).resolves.toMatchObject({ estado: "ANULADO" })
    expect(prisma.gastoCorriente.update).toHaveBeenCalledWith({ where: { id: "gasto-1" }, data: { estado: "ANULADO" } })
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: "shift-1" }, data: { fondoFinal: 465 } })
    expect(prisma.eventoAuditoria.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accion: "GASTO_ANULADO", registroId: "gasto-1" }),
    }))
  })

  it("impide anular un gasto con pagos aplicados", async () => {
    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      entidad: "CAFETERIA",
      shiftId: "shift-1",
      fechaDevengo: new Date("2026-08-23"),
      estado: "PAGADO",
      importe: 125.5,
      aplicaciones: [{ id: "application-1" }],
    } as any)

    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({ code: "EXPENSE_HAS_PAYMENTS" })
    expect(prisma.gastoCorriente.update).not.toHaveBeenCalled()
  })

  it("protects current-expense deletion and reports missing shift expenses", async () => {
    await expect(deleteCurrentExpense({ id: "employee-1", role: "EMPLEADO" }, "gasto-1")).rejects.toMatchObject({
      code: "PAYMENT_FORBIDDEN",
    })

    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue(null)
    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    })

    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      shiftId: null,
      estado: "PENDIENTE_AUTORIZACION",
      aplicaciones: [],
    } as any)
    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    })
  })

  it("incluye el nombre del solicitante en el dashboard de pagos", async () => {
    vi.mocked(prisma.factura.findMany).mockResolvedValue([])
    vi.mocked(prisma.gastoCorriente.findMany).mockResolvedValue([{
      id: "gasto-1",
      solicitante: { id: "user-1", name: "Ana García", email: "ana@example.com" },
    }] as any)
    vi.mocked(prisma.pago.findMany).mockResolvedValue([])
    vi.mocked(prisma.cuentaFondos.findMany).mockResolvedValue([])
    vi.mocked(prisma.medioPago.findMany).mockResolvedValue([])

    const dashboard = await getPaymentDashboard("OBRADOR")

    expect(prisma.gastoCorriente.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ entidad: "OBRADOR", shiftId: { not: null } }),
      include: expect.objectContaining({
        solicitante: { select: { id: true, name: true, email: true } },
      }),
    }))
    expect(dashboard.expenses[0]).toMatchObject({ solicitante: { name: "Ana García" } })
  })

  it("calculates payment indicators from non-annulled movements and documents", async () => {
    const from = new Date("2026-08-01T00:00:00.000Z")
    const to = new Date("2026-09-01T00:00:00.000Z")
    vi.mocked(prisma.pago.findMany).mockResolvedValue([
      { importeTotal: new Prisma.Decimal(100), excesoAutorizadoPorId: "authorizer-1" },
      { importeTotal: new Prisma.Decimal(50), excesoAutorizadoPorId: null },
    ] as any)
    vi.mocked(prisma.pago.aggregate).mockResolvedValue({ _sum: { importeTotal: new Prisma.Decimal(25) } } as any)
    vi.mocked(prisma.gastoCorriente.aggregate)
      .mockResolvedValueOnce({ _sum: { importe: new Prisma.Decimal(12) } } as any)
      .mockResolvedValueOnce({ _sum: { importe: new Prisma.Decimal(8) } } as any)
    vi.mocked(prisma.movimientoExtracto.count).mockResolvedValue(3)
    vi.mocked(prisma.factura.count).mockResolvedValue(4)
    vi.mocked(prisma.anticipo.count).mockResolvedValue(5)

    const indicators = await getIndicators("OBRADOR", from, to)

    expect(indicators.P1.cantidad).toBe(1)
    expect(indicators.P1.importe.toString()).toBe("100")
    expect(indicators.P1c).toBe(4)
    expect(indicators.P3.importe.toString()).toBe("25")
    expect(indicators.P3.porcentaje.toString()).toBe("16.666666666666666667")
    expect(indicators.P4.toString()).toBe("12")
    expect(indicators.P5).toBe(3)
    expect(indicators.P6.toString()).toBe("8")
    expect(indicators.P7).toBe(5)
    expect(prisma.pago.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ entidad: "OBRADOR", fechaPago: { gte: from, lt: to } }),
    }))
  })

  it("permite el fallback transitorio de ADMIN mientras se asignan funciones", async () => {
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue(null)
    await expect(userHasPaymentFunction("admin", "EJECUTAR", "OBRADOR", "ADMIN")).resolves.toBe(true)
  })

  it("bloquea aplicaciones duplicadas dentro de una misma operación", async () => {
    vi.mocked(prisma.medioPago.findUnique).mockResolvedValue({ id: "MP-TRANSF", estado: "ACTIVO", requiereCuenta: true, tipo: "TRANSFERENCIA", limiteOperacion: null } as any)
    vi.mocked(prisma.cuentaFondos.findUnique).mockResolvedValue({ id: "BCO-OBR-01", estado: "ACTIVA", entidad: "OBRADOR", tipo: "BANCO" } as any)
    vi.mocked((prisma as any).acreedor.findUnique).mockResolvedValue({ id: "acr-1", estado: "ACTIVO" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
      asignacionPagoUsuario: { findFirst: vi.fn().mockResolvedValue(null) },
      cierreMensual: { findUnique: vi.fn().mockResolvedValue(null) },
      medioPago: prisma.medioPago,
      cuentaFondos: prisma.cuentaFondos,
      acreedor: (prisma as any).acreedor,
    }))

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [
        { tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 10 },
        { tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 5 },
      ],
    })).rejects.toMatchObject({ code: "DUPLICATE_APPLICATION" })
  })

  it("creates a payment, records the fund movement and closes a fully paid invoice", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.pagoAplicacion.aggregate)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 100 } } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [{ tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 100 }],
    })).resolves.toMatchObject({ id: "payment-1" })

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2)
    expect(transaction.secuenciaPago.upsert).toHaveBeenCalledWith({
      where: { entidad: "OBRADOR" },
      create: { entidad: "OBRADOR", ultimoNumero: 1 },
      update: { ultimoNumero: { increment: 1 } },
    })
    expect(transaction.movimientoFondos.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cuentaFondosId: "BCO-OBR-01",
        tipo: "SALIDA_PAGO",
        origenId: "payment-1",
      }),
    }))
    expect(transaction.cuentaFondos.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "BCO-OBR-01" },
    }))
    expect(transaction.factura.update).toHaveBeenCalledWith({
      where: { id: "fac-1" },
      data: { estadoPago: "PAGADA", importePagado: new Prisma.Decimal(100) },
    })
    expect(transaction.eventoAuditoria.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accion: "PAGO_CREADO", registroId: "payment-1" }),
    }))
  })

  it("applies payments to an authorized expense and advance", async () => {
    const expenseTransaction = makePaymentTransaction()
    vi.mocked(expenseTransaction.gastoCorriente.findUnique).mockResolvedValue({
      id: "expense-1",
      entidad: "OBRADOR",
      acreedorId: "acr-1",
      estado: "AUTORIZADO",
      importe: new Prisma.Decimal(50),
      categoria: { codigo: "SUM" },
    } as any)
    vi.mocked(expenseTransaction.pagoAplicacion.aggregate)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 50 } } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [{ tipoDestino: "GASTO", destinoId: "expense-1", importeAplicado: 50 }],
    })).resolves.toMatchObject({ id: "payment-1" })
    expect(expenseTransaction.gastoCorriente.update).toHaveBeenCalledWith({
      where: { id: "expense-1" },
      data: { estado: "PAGADO" },
    })

    const advanceTransaction = makePaymentTransaction()
    vi.mocked(advanceTransaction.anticipo.findUnique).mockResolvedValue({
      id: "advance-1",
      entidad: "OBRADOR",
      acreedorId: "acr-1",
      estado: "AUTORIZADO",
      importe: new Prisma.Decimal(50),
      importeAplicado: new Prisma.Decimal(0),
    } as any)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [{ tipoDestino: "ANTICIPO", destinoId: "advance-1", importeAplicado: 50 }],
    })).resolves.toMatchObject({ id: "payment-1" })
    expect(advanceTransaction.anticipo.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "advance-1" },
      data: expect.objectContaining({ estado: "PAGADO" }),
    }))
    const advanceUpdate = vi.mocked(advanceTransaction.anticipo.update).mock.calls[0]?.[0] as any
    expect(advanceUpdate.data.importeAplicado.increment.toString()).toBe("50")
  })

  it("validates the invoice target before applying a payment", async () => {
    const transaction = makePaymentTransaction()
    const invoice = {
      id: "fac-1",
      entidad: "OBRADOR",
      acreedorId: "acr-1",
      estadoCircuito: "CONFORMADA",
      importeConformado: new Prisma.Decimal(10),
      importeRetenido: new Prisma.Decimal(0),
    }

    const cases = [
      [null, "DOCUMENT_NOT_FOUND"],
      [{ ...invoice, entidad: "CAFETERIA" }, "ENTITY_MISMATCH"],
      [{ ...invoice, acreedorId: "other-creditor" }, "CREDITOR_MISMATCH"],
      [{ ...invoice, estadoCircuito: "BORRADOR" }, "DOCUMENT_NOT_PAYABLE"],
      [{ ...invoice, importeConformado: null }, "MISSING_CONFORMED_AMOUNT"],
      [{ ...invoice, importeConformado: new Prisma.Decimal(5) }, "AMOUNT_OVER_PENDING"],
    ] as const

    for (const [target, code] of cases) {
      vi.mocked(transaction.factura.findUnique).mockResolvedValueOnce(target as any)
      await expect(createPayment({ id: "user-1", role: "ADMIN" }, makePaymentInput())).rejects.toMatchObject({ code })
    }
  })

  it("rejects caller-supplied excess approvals", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.asignacionPagoUsuario.findFirst).mockResolvedValue({ id: "assignment-1" } as any)
    vi.mocked(transaction.pagoAplicacion.aggregate)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { importeAplicado: 120 } } as any)

    await expect(createPayment({ id: "executor-1", role: "ADMIN" }, makePaymentInput({
      aplicaciones: [{ tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 120 }],
      excesoAutorizadoPorId: "authorizer-1",
      motivoExceso: "Ajuste aprobado por dirección",
    }))).rejects.toMatchObject({ code: "EXCESS_APPROVAL_REQUIRED" })
    expect(transaction.pago.create).not.toHaveBeenCalled()
  })

  it("rejects unavailable payment methods and malformed payment dates", async () => {
    const transaction = makePaymentTransaction()
    vi.mocked(transaction.medioPago.findUnique).mockResolvedValue(null)

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "2026-08-23",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [{ tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 10 }],
    })).rejects.toMatchObject({ code: "PAYMENT_METHOD_UNAVAILABLE" })

    await expect(createPayment({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      fechaPago: "invalid-date",
      medioPagoId: "MP-TRANSF",
      cuentaFondosId: "BCO-OBR-01",
      acreedorId: "acr-1",
      aplicaciones: [{ tipoDestino: "FACTURA", destinoId: "fac-1", importeAplicado: 10 }],
    })).rejects.toMatchObject({ message: "Fecha no válida" })
  })

  it("serializa errores de dominio con código y estado", () => {
    const result = serializePaymentError(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))
    expect(result).toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN", status: 403 })
  })
})
