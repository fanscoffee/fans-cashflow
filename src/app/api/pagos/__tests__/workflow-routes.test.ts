import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const createPayment = vi.hoisted(() => vi.fn())
const getPaymentDashboard = vi.hoisted(() => vi.fn())
const createAdvance = vi.hoisted(() => vi.fn())
const getIndicators = vi.hoisted(() => vi.fn())
const requirePaymentFunction = vi.hoisted(() => vi.fn())
const authorizeExpense = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    advance: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments")
  return {
    ...actual,
    createPayment,
    getPaymentDashboard,
    createAdvance,
    getIndicators,
    requirePaymentFunction,
    authorizeExpense,
  }
})

import { GET as getPayments, POST as postPayment } from "../route"
import { GET as getIndicatorsRoute } from "../indicadores/route"
import { GET as getAdvances, POST as postAdvance } from "../anticipos/route"
import { PATCH as patchAuthorizeExpense } from "../gastos/[id]/autorizar/route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PaymentDomainError } from "@/lib/payments"

const context = { params: Promise.resolve({ id: "expense-1" }) }

function request(url: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest
}

const validPayment = {
  entity: "BAKERY",
  paymentDate: "2026-08-23",
  paymentMethodId: "method-1",
  fundsAccountId: "account-1",
  creditorId: "creditor-1",
  applications: [{ destinationType: "INVOICE", destinationId: "invoice-1", appliedAmount: 10 }],
}

describe("payment workflow routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(requirePaymentFunction).mockResolvedValue(undefined)
  })

  it("loads the payment dashboard and maps domain errors", async () => {
    vi.mocked(getPaymentDashboard).mockResolvedValue({ invoices: [], expenses: [], pendingExpenses: [], payments: [], cashAccounts: [], methods: [] } as any)
    const response = await getPayments(request("http://localhost/api/pagos?entidad=CAFETERIA"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ invoices: [], expenses: [], pendingExpenses: [], payments: [], cashAccounts: [], methods: [] })
    expect(requirePaymentFunction).toHaveBeenCalledWith("admin-1", "REQUEST", "COFFEE_SHOP", "ADMIN")

    vi.mocked(requirePaymentFunction).mockRejectedValue(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))
    const forbidden = await getPayments(request("http://localhost/api/pagos"))
    expect(forbidden.status).toBe(403)
    await expect(forbidden.json()).resolves.toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN" })
  })

  it("validates and creates payments", async () => {
    const invalid = await postPayment(request("http://localhost/api/pagos", "POST", { entity: "OBRADOR" }))
    expect(invalid.status).toBe(400)
    expect(createPayment).not.toHaveBeenCalled()

    vi.mocked(createPayment).mockResolvedValue({ id: "payment-1", status: "ORDENADO" } as any)
    const response = await postPayment(request("http://localhost/api/pagos", "POST", validPayment))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: "payment-1", status: "ORDENADO" })
    expect(createPayment).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN" }, validPayment)
  })

  it("validates indicator periods and returns indicators", async () => {
    vi.mocked(getIndicators).mockResolvedValue({ P1: { quantity: 0 } } as any)
    const response = await getIndicatorsRoute(request("http://localhost/api/pagos/indicadores?entidad=OBRADOR&year=2026&month=8"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ entity: "BAKERY", year: 2026, month: 8, metrics: { P1: { quantity: 0 } } })
    expect(getIndicators).toHaveBeenCalledWith("BAKERY", expect.any(Date), expect.any(Date))

    expect((await getIndicatorsRoute(request("http://localhost/api/pagos/indicadores?year=2026&month=13"))).status).toBe(400)
    vi.mocked(requirePaymentFunction).mockRejectedValue(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))
    expect((await getIndicatorsRoute(request("http://localhost/api/pagos/indicadores"))).status).toBe(403)
  })

  it("lists and creates advances", async () => {
    vi.mocked(prisma.advance.findMany).mockResolvedValue([{ id: "advance-1" }] as any)
    const list = await getAdvances(request("http://localhost/api/pagos/anticipos?entidad=OBRADOR"))
    expect(list.status).toBe(200)
    await expect(list.json()).resolves.toEqual([{ id: "advance-1" }])

    vi.mocked(createAdvance).mockResolvedValue({ id: "advance-1", status: "PENDIENTE_AUTORIZACION" } as any)
    const created = await postAdvance(request("http://localhost/api/pagos/anticipos", "POST", {
      entity: "OBRADOR",
      creditorId: "creditor-1",
      concept: "Anticipo de servicio",
      date: "2026-08-23",
      amount: 100,
    }))
    expect(created.status).toBe(201)
    await expect(created.json()).resolves.toMatchObject({ id: "advance-1" })
  })

  it("parses expense authorization payloads and delegates to the domain service", async () => {
    vi.mocked(authorizeExpense).mockResolvedValue({ id: "expense-1", status: "AUTORIZADO" } as any)
    const response = await patchAuthorizeExpense(request("http://localhost/api/pagos/gastos/expense-1", "PATCH", {
      authorizerId: "admin-1",
      approve: true,
    }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: "expense-1", status: "AUTORIZADO" })
    expect(authorizeExpense).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN" }, "expense-1", {
      authorizerId: "admin-1",
      approve: true,
    })

    expect((await patchAuthorizeExpense(request("http://localhost/api/pagos/gastos/expense-1", "PATCH", {}), context)).status).toBe(400)
  })
})
