import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const requirePaymentFunction = vi.hoisted(() => vi.fn())
const auditPaymentEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditorAccountChange: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    creditor: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments")
  return { ...actual, requirePaymentFunction, auditPaymentEvent }
})

import { GET, PATCH, POST } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const context = { params: Promise.resolve({ id: "creditor-1" }) }
const changeContext = { params: Promise.resolve({ id: "change-1" }) }
const tx = {
  creditorAccountChange: { update: vi.fn() },
  creditor: { update: vi.fn() },
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/pagos/acreedores/creditor-1/cuenta", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("acreedor account change route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(requirePaymentFunction).mockResolvedValue(undefined)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
  })

  it("lists requested account changes", async () => {
    vi.mocked(prisma.creditorAccountChange.findMany).mockResolvedValue([{ id: "change-1" }] as any)

    const response = await GET(request("GET"), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: "change-1" }])
    expect(prisma.creditorAccountChange.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { creditorId: "creditor-1" } }))
  })

  it("validates and records a requested account change", async () => {
    expect((await POST(request("POST", { newAccountLast4: "12", reason: "Cambio" }), context)).status).toBe(400)

    vi.mocked(prisma.creditor.findUnique).mockResolvedValue(null)
    expect((await POST(request("POST", { newAccountLast4: "1234", reason: "Cambio de cuenta" }), context)).status).toBe(409)

    vi.mocked(prisma.creditor.findUnique).mockResolvedValue({
      id: "creditor-1",
      defaultEntity: "OBRADOR",
      destinationAccountLast4: "0000",
      status: "ACTIVO",
    } as any)
    vi.mocked(prisma.creditorAccountChange.create).mockResolvedValue({ id: "change-1" } as any)
    const response = await POST(request("POST", { newAccountLast4: "1234", reason: "Cambio de cuenta" }), context)

    expect(response.status).toBe(201)
    expect(prisma.creditorAccountChange.create).toHaveBeenCalledWith({
      data: {
        creditorId: "creditor-1",
        previousAccountLast4: "0000",
        newAccountLast4: "1234",
        reason: "Cambio de cuenta",
        requestedById: "admin-1",
      },
    })
  })

  it("requires a second authorized person to approve a pending change", async () => {
    expect((await PATCH(request("PATCH", {}), changeContext)).status).toBe(400)

    vi.mocked(prisma.creditorAccountChange.findUnique).mockResolvedValue(null)
    expect((await PATCH(request("PATCH", { action: "AUTORIZAR", confirmationChannel: "Teléfono" }), changeContext)).status).toBe(404)

    vi.mocked(prisma.creditorAccountChange.findUnique).mockResolvedValue({
      id: "change-1",
      creditorId: "creditor-1",
      requestedById: "admin-1",
      status: "PENDIENTE",
      newAccountLast4: "1234",
      creditor: { defaultEntity: "OBRADOR" },
    } as any)
    expect((await PATCH(request("PATCH", { action: "AUTORIZAR", confirmationChannel: "Teléfono" }), changeContext)).status).toBe(409)

    vi.mocked(prisma.creditorAccountChange.findUnique).mockResolvedValue({
      id: "change-1",
      creditorId: "creditor-1",
      requestedById: "requester-1",
      status: "AUTORIZADO",
      newAccountLast4: "1234",
      creditor: { defaultEntity: "OBRADOR" },
    } as any)
    expect((await PATCH(request("PATCH", { action: "AUTORIZAR", confirmationChannel: "Teléfono" }), changeContext)).status).toBe(409)

    vi.mocked(prisma.creditorAccountChange.findUnique).mockResolvedValue({
      id: "change-1",
      creditorId: "creditor-1",
      requestedById: "requester-1",
      status: "PENDIENTE",
      newAccountLast4: "1234",
      creditor: { defaultEntity: "OBRADOR" },
    } as any)
    vi.mocked(tx.creditorAccountChange.update).mockResolvedValue({ id: "change-1", status: "AUTORIZADO" } as any)
    const response = await PATCH(request("PATCH", { action: "AUTORIZAR", confirmationChannel: "Teléfono" }), changeContext)

    expect(response.status).toBe(200)
    expect(tx.creditorAccountChange.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "change-1" },
      data: expect.objectContaining({ status: "AUTORIZADO", confirmationChannel: "Teléfono" }),
    }))
    expect(tx.creditor.update).toHaveBeenCalledWith({ where: { id: "creditor-1" }, data: { destinationAccountLast4: "1234" } })
  })
})
