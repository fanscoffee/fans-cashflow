import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const requirePaymentFunction = vi.hoisted(() => vi.fn())
const auditPaymentEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentMethod: { findMany: vi.fn(), create: vi.fn() },
    fundsAccount: { findMany: vi.fn() },
    expenseCategory: { findMany: vi.fn(), create: vi.fn() },
    creditor: { findMany: vi.fn(), create: vi.fn() },
    userPaymentAssignment: { findMany: vi.fn(), create: vi.fn() },
    authorizationParameter: { findMany: vi.fn(), findFirst: vi.fn() },
    authorizationRule: { findMany: vi.fn(), create: vi.fn() },
    fundsMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments")
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
  fundsAccount: { create: vi.fn() },
  fundsMovement: { create: vi.fn() },
  authorizationParameter: { updateMany: vi.fn(), create: vi.fn() },
  auditEvent: { create: vi.fn() },
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
    vi.mocked(prisma.expenseCategory.findMany).mockResolvedValue([{ id: "cat-1" }] as any)
    vi.mocked(prisma.creditor.findMany).mockResolvedValue([{ id: "creditor-1" }] as any)
    vi.mocked(prisma.fundsAccount.findMany).mockResolvedValue([{ id: "account-1" }] as any)
    vi.mocked(prisma.paymentMethod.findMany).mockResolvedValue([{ id: "method-1" }] as any)

    const response = await getConfiguration(request("http://localhost/api/pagos/configuracion?entidad=CAFETERIA"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      categories: [{ id: "cat-1" }],
      creditors: [{ id: "creditor-1" }],
      accounts: [{ id: "account-1" }],
      paymentMethods: [{ id: "method-1" }],
      entities: ["BAKERY", "COFFEE_SHOP"],
      entidades: ["OBRADOR", "CAFETERIA"],
    })
  })

  it("lists and creates methods, categories, creditors and assignments", async () => {
    vi.mocked(prisma.paymentMethod.findMany).mockResolvedValue([{ id: "method-1" }] as any)
    expect((await getMethods(request("http://localhost/api/pagos/medios"))).status).toBe(200)
    vi.mocked(prisma.paymentMethod.create).mockResolvedValue({ id: "method-1" } as any)
    expect((await postMethod(request("http://localhost/api/pagos/medios", "POST", {
      id: "method-1",
      type: "TRANSFERENCIA",
    }))).status).toBe(201)

    vi.mocked(prisma.expenseCategory.findMany).mockResolvedValue([{ id: "cat-1" }] as any)
    expect((await getCategories(request("http://localhost/api/pagos/categorias"))).status).toBe(200)
    vi.mocked(prisma.expenseCategory.create).mockResolvedValue({ id: "cat-1" } as any)
    expect((await postCategory(request("http://localhost/api/pagos/categorias", "POST", {
      code: "SUM",
      name: "Suministros",
    }))).status).toBe(201)

    vi.mocked(prisma.creditor.findMany).mockResolvedValue([{ id: "creditor-1" }] as any)
    expect((await getCreditors(request("http://localhost/api/pagos/acreedores"))).status).toBe(200)
    vi.mocked(prisma.creditor.create).mockResolvedValue({ id: "creditor-1" } as any)
    expect((await postCreditor(request("http://localhost/api/pagos/acreedores", "POST", {
      code: "SERV-1",
      type: "SERVICIOS",
      name: "Servicio local",
    }))).status).toBe(201)

    vi.mocked(prisma.userPaymentAssignment.findMany).mockResolvedValue([{ id: "assignment-1" }] as any)
    expect((await getAssignments(request("http://localhost/api/pagos/asignaciones"))).status).toBe(200)
    vi.mocked(prisma.userPaymentAssignment.create).mockResolvedValue({ id: "assignment-1" } as any)
    expect((await postAssignment(request("http://localhost/api/pagos/asignaciones", "POST", {
      userId: "user-1",
      function: "SOLICITAR",
    }))).status).toBe(201)
    expect(auditPaymentEvent).toHaveBeenCalled()
  })

  it("validates and creates fund accounts with an opening movement", async () => {
    vi.mocked(prisma.fundsAccount.findMany).mockResolvedValue([{ id: "account-1" }] as any)
    expect((await getAccounts(request("http://localhost/api/pagos/cuentas?entidad=OBRADOR"))).status).toBe(200)

    const missingFixedFund = await postAccount(request("http://localhost/api/pagos/cuentas", "POST", {
      id: "cash-1",
      type: "CAJA_CHICA",
      entity: "OBRADOR",
      description: "Caja chica",
      responsibleUserId: "user-1",
    }))
    expect(missingFixedFund.status).toBe(400)

    vi.mocked(tx.fundsAccount.create).mockResolvedValue({ id: "account-1", type: "BANCO", entity: "OBRADOR" } as any)
    const response = await postAccount(request("http://localhost/api/pagos/cuentas", "POST", {
      id: "account-1",
      type: "BANCO",
      entity: "OBRADOR",
      description: "Banco principal",
      responsibleUserId: "user-1",
      balanceInicial: 100,
    }))
    expect(response.status).toBe(201)
    expect(tx.fundsMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "ALLOCATION_INFLOW", amount: 100 }),
    }))
  })

  it("lists and versions authorization parameters and rules", async () => {
    vi.mocked(prisma.authorizationParameter.findMany).mockResolvedValue([{ id: "parameter-1" }] as any)
    vi.mocked(prisma.authorizationRule.findMany).mockResolvedValue([{ id: "rule-1" }] as any)
    expect((await getParameters(request("http://localhost/api/pagos/parametros"))).status).toBe(200)

    vi.mocked(prisma.authorizationParameter.findFirst).mockResolvedValue({ version: 2 } as any)
    vi.mocked(tx.authorizationParameter.create).mockResolvedValue({ id: "parameter-3" } as any)
    const parameter = await postParameter(request("http://localhost/api/pagos/parametros", "POST", {
      recordType: "PARAMETRO",
      code: "LIMITE_PAGO",
      decimalValue: 500,
    }))
    expect(parameter.status).toBe(201)
    expect(tx.authorizationParameter.updateMany).toHaveBeenCalled()
    expect(tx.authorizationParameter.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 3, decimalValue: 500 }),
    }))

    vi.mocked(prisma.authorizationRule.create).mockResolvedValue({ id: "rule-1" } as any)
    const rule = await postParameter(request("http://localhost/api/pagos/parametros", "POST", {
      recordType: "REGLA",
      amountFrom: 100,
      requiredFunction: "AUTORIZAR",
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
