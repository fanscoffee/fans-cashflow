import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const requirePaymentFunction = vi.hoisted(() => vi.fn())
const auditPaymentEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    medioPago: { findMany: vi.fn(), create: vi.fn() },
    cuentaFondos: { findMany: vi.fn() },
    categoriaGasto: { findMany: vi.fn(), create: vi.fn() },
    acreedor: { findMany: vi.fn(), create: vi.fn() },
    asignacionPagoUsuario: { findMany: vi.fn(), create: vi.fn() },
    parametroAutorizacion: { findMany: vi.fn(), findFirst: vi.fn() },
    reglaAutorizacion: { findMany: vi.fn(), create: vi.fn() },
    movimientoFondos: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/pagos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pagos")>("@/lib/pagos")
  return { ...actual, requirePaymentFunction, auditPaymentEvent }
})

import { GET as getMethods, POST as postMethod } from "../medios/route"
import { GET as getAccounts, POST as postAccount } from "../cuentas/route"
import { GET as getCategories, POST as postCategory } from "../categorias/route"
import { GET as getParameters, POST as postParameter } from "../parametros/route"
import { GET as getConfiguration } from "../configuracion/route"
import { GET as getAssignments, POST as postAssignment } from "../asignaciones/route"
import { GET as getCreditors, POST as postCreditor } from "../acreedores/route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const tx = {
  cuentaFondos: { create: vi.fn() },
  movimientoFondos: { create: vi.fn() },
  parametroAutorizacion: { updateMany: vi.fn(), create: vi.fn() },
  eventoAuditoria: { create: vi.fn() },
}

function request(url: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("payment configuration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(requirePaymentFunction).mockResolvedValue(undefined)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
  })

  it("loads the payment configuration for an entity", async () => {
    vi.mocked(prisma.categoriaGasto.findMany).mockResolvedValue([{ id: "cat-1" }] as any)
    vi.mocked(prisma.acreedor.findMany).mockResolvedValue([{ id: "creditor-1" }] as any)
    vi.mocked(prisma.cuentaFondos.findMany).mockResolvedValue([{ id: "account-1" }] as any)
    vi.mocked(prisma.medioPago.findMany).mockResolvedValue([{ id: "method-1" }] as any)

    const response = await getConfiguration(request("http://localhost/api/pagos/configuracion?entidad=CAFETERIA"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      categorias: [{ id: "cat-1" }],
      acreedores: [{ id: "creditor-1" }],
      cuentas: [{ id: "account-1" }],
      medios: [{ id: "method-1" }],
      entidades: ["OBRADOR", "CAFETERIA"],
    })
  })

  it("lists and creates methods, categories, creditors and assignments", async () => {
    vi.mocked(prisma.medioPago.findMany).mockResolvedValue([{ id: "method-1" }] as any)
    expect((await getMethods(request("http://localhost/api/pagos/medios"))).status).toBe(200)
    vi.mocked(prisma.medioPago.create).mockResolvedValue({ id: "method-1" } as any)
    expect((await postMethod(request("http://localhost/api/pagos/medios", "POST", {
      id: "method-1",
      tipo: "TRANSFERENCIA",
    }))).status).toBe(201)

    vi.mocked(prisma.categoriaGasto.findMany).mockResolvedValue([{ id: "cat-1" }] as any)
    expect((await getCategories(request("http://localhost/api/pagos/categorias"))).status).toBe(200)
    vi.mocked(prisma.categoriaGasto.create).mockResolvedValue({ id: "cat-1" } as any)
    expect((await postCategory(request("http://localhost/api/pagos/categorias", "POST", {
      codigo: "SUM",
      nombre: "Suministros",
    }))).status).toBe(201)

    vi.mocked(prisma.acreedor.findMany).mockResolvedValue([{ id: "creditor-1" }] as any)
    expect((await getCreditors(request("http://localhost/api/pagos/acreedores"))).status).toBe(200)
    vi.mocked(prisma.acreedor.create).mockResolvedValue({ id: "creditor-1" } as any)
    expect((await postCreditor(request("http://localhost/api/pagos/acreedores", "POST", {
      codigo: "SERV-1",
      tipo: "SERVICIOS",
      nombre: "Servicio local",
    }))).status).toBe(201)

    vi.mocked(prisma.asignacionPagoUsuario.findMany).mockResolvedValue([{ id: "assignment-1" }] as any)
    expect((await getAssignments(request("http://localhost/api/pagos/asignaciones"))).status).toBe(200)
    vi.mocked(prisma.asignacionPagoUsuario.create).mockResolvedValue({ id: "assignment-1" } as any)
    expect((await postAssignment(request("http://localhost/api/pagos/asignaciones", "POST", {
      userId: "user-1",
      funcion: "SOLICITAR",
    }))).status).toBe(201)
    expect(auditPaymentEvent).toHaveBeenCalled()
  })

  it("validates and creates fund accounts with an opening movement", async () => {
    vi.mocked(prisma.cuentaFondos.findMany).mockResolvedValue([{ id: "account-1" }] as any)
    expect((await getAccounts(request("http://localhost/api/pagos/cuentas?entidad=OBRADOR"))).status).toBe(200)

    const missingFixedFund = await postAccount(request("http://localhost/api/pagos/cuentas", "POST", {
      id: "cash-1",
      tipo: "CAJA_CHICA",
      entidad: "OBRADOR",
      descripcion: "Caja chica",
      responsableId: "user-1",
    }))
    expect(missingFixedFund.status).toBe(400)

    vi.mocked(tx.cuentaFondos.create).mockResolvedValue({ id: "account-1", tipo: "BANCO", entidad: "OBRADOR" } as any)
    const response = await postAccount(request("http://localhost/api/pagos/cuentas", "POST", {
      id: "account-1",
      tipo: "BANCO",
      entidad: "OBRADOR",
      descripcion: "Banco principal",
      responsableId: "user-1",
      saldoInicial: 100,
    }))
    expect(response.status).toBe(201)
    expect(tx.movimientoFondos.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: "ENTRADA_DOTACION", importe: 100 }),
    }))
  })

  it("lists and versions authorization parameters and rules", async () => {
    vi.mocked(prisma.parametroAutorizacion.findMany).mockResolvedValue([{ id: "parameter-1" }] as any)
    vi.mocked(prisma.reglaAutorizacion.findMany).mockResolvedValue([{ id: "rule-1" }] as any)
    expect((await getParameters(request("http://localhost/api/pagos/parametros"))).status).toBe(200)

    vi.mocked(prisma.parametroAutorizacion.findFirst).mockResolvedValue({ version: 2 } as any)
    vi.mocked(tx.parametroAutorizacion.create).mockResolvedValue({ id: "parameter-3" } as any)
    const parameter = await postParameter(request("http://localhost/api/pagos/parametros", "POST", {
      tipoRegistro: "PARAMETRO",
      codigo: "LIMITE_PAGO",
      valorDecimal: 500,
    }))
    expect(parameter.status).toBe(201)
    expect(tx.parametroAutorizacion.updateMany).toHaveBeenCalled()
    expect(tx.parametroAutorizacion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 3, valorDecimal: 500 }),
    }))

    vi.mocked(prisma.reglaAutorizacion.create).mockResolvedValue({ id: "rule-1" } as any)
    const rule = await postParameter(request("http://localhost/api/pagos/parametros", "POST", {
      tipoRegistro: "REGLA",
      importeDesde: 100,
      funcionRequerida: "AUTORIZAR",
    }))
    expect(rule.status).toBe(201)
  })

  it("maps payment permission failures to HTTP errors", async () => {
    vi.mocked(requirePaymentFunction).mockRejectedValue(new Error("not allowed"))

    const response = await getMethods(request("http://localhost/api/pagos/medios"))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Error interno del módulo de pagos", code: "PAYMENT_ERROR" })
  })
})
