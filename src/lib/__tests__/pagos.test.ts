import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asignacionPagoUsuario: { findFirst: vi.fn() },
    categoriaGasto: { findUnique: vi.fn() },
    parametroAutorizacion: { findFirst: vi.fn() },
    gastoCorriente: { aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    acreedor: { upsert: vi.fn(), findUnique: vi.fn() },
    eventoAuditoria: { create: vi.fn() },
    $transaction: vi.fn(),
    medioPago: { findUnique: vi.fn() },
    cuentaFondos: { findUnique: vi.fn() },
  },
}))

import {
  PaymentDomainError,
  authorizeExpense,
  createPayment,
  createExpense,
  createPaymentSchema,
  serializePaymentError,
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

  it("bloquea compras sin factura fuera de la categoría MEN", async () => {
    vi.mocked(prisma.categoriaGasto.findUnique).mockResolvedValue({ id: "cat", codigo: "SUM", activo: true } as any)
    await expect(createExpense({ id: "user-1", role: "ADMIN" }, {
      entidad: "OBRADOR",
      categoriaId: "cat",
      concepto: "Agua urgente",
      fechaDevengo: "2026-08-23",
      importe: 10,
      justificante: "SIN_JUSTIFICANTE",
    })).rejects.toMatchObject({ code: "MINOR_CATEGORY_REQUIRED" })
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
