import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asignacionPagoUsuario: { findFirst: vi.fn() },
    shift: { findUnique: vi.fn(), update: vi.fn() },
    expense: { aggregate: vi.fn() },
    factura: { findMany: vi.fn() },
    categoriaGasto: { findUnique: vi.fn() },
    parametroAutorizacion: { findFirst: vi.fn() },
    reglaAutorizacion: { findMany: vi.fn() },
    gastoCorriente: { aggregate: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    acreedor: { upsert: vi.fn(), findUnique: vi.fn() },
    eventoAuditoria: { create: vi.fn() },
    $transaction: vi.fn(),
    medioPago: { findMany: vi.fn(), findUnique: vi.fn() },
    cuentaFondos: { findMany: vi.fn(), findUnique: vi.fn() },
    pago: { findMany: vi.fn() },
  },
}))

import {
  PaymentDomainError,
  authorizeExpense,
  deleteCurrentExpense,
  createPayment,
  createExpense,
  createPaymentSchema,
  serializePaymentError,
  getPaymentDashboard,
  userHasPaymentFunction,
} from "@/lib/pagos"
import { prisma } from "@/lib/prisma"

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

  it("impide que el solicitante autorice su propio gasto", async () => {
    vi.mocked(prisma.gastoCorriente.findUnique).mockResolvedValue({
      id: "gasto-1",
      entidad: "OBRADOR",
      solicitanteId: "user-1",
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
      estado: "PAGADO",
      importe: 125.5,
      aplicaciones: [{ id: "application-1" }],
    } as any)

    await expect(deleteCurrentExpense({ id: "partner-1", role: "SOCIO" }, "gasto-1")).rejects.toMatchObject({ code: "EXPENSE_HAS_PAYMENTS" })
    expect(prisma.gastoCorriente.update).not.toHaveBeenCalled()
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

  it("permite el fallback transitorio de ADMIN mientras se asignan funciones", async () => {
    vi.mocked(prisma.asignacionPagoUsuario.findFirst).mockResolvedValue(null)
    await expect(userHasPaymentFunction("admin", "EJECUTAR", "OBRADOR", "ADMIN")).resolves.toBe(true)
  })

  it("bloquea aplicaciones duplicadas dentro de una misma operación", async () => {
    vi.mocked(prisma.medioPago.findUnique).mockResolvedValue({ id: "MP-TRANSF", estado: "ACTIVO", requiereCuenta: true, tipo: "TRANSFERENCIA", limiteOperacion: null } as any)
    vi.mocked(prisma.cuentaFondos.findUnique).mockResolvedValue({ id: "BCO-OBR-01", estado: "ACTIVA", entidad: "OBRADOR", tipo: "BANCO" } as any)
    vi.mocked((prisma as any).acreedor.findUnique).mockResolvedValue({ id: "acr-1", estado: "ACTIVO" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      asignacionPagoUsuario: { findFirst: vi.fn().mockResolvedValue(null) },
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

  it("serializa errores de dominio con código y estado", () => {
    const result = serializePaymentError(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))
    expect(result).toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN", status: 403 })
  })
})
