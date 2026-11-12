import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const tx = {
  invoice: { update: vi.fn() },
  accountingInvoice: { update: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/payments", () => ({ auditPaymentEvent: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { auditPaymentEvent } from "@/lib/payments"

const context = { params: Promise.resolve({ id: "invoice-1" }) }

function request(body: unknown) {
  return new Request("http://localhost/api/inventario/facturas/invoice-1/resolver-incidencia", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("PATCH /api/inventario/facturas/[id]/resolver-incidencia", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: "invoice-1",
      entity: "BAKERY",
      workflowStatus: "ISSUE",
      paymentStatus: "PAGADA",
      paidAmount: 121,
      totalAmount: 121,
      confirmedAmount: null,
      alerts: ["Diferencia de total: 0,01 €"],
      accountingInvoice: { id: "capture-1", reconciliationStatus: "ISSUE" },
    } as any)
    vi.mocked(tx.invoice.update).mockResolvedValue({ id: "invoice-1", workflowStatus: "CONFIRMED", paymentStatus: "PAGADA", alerts: null } as any)
    vi.mocked(tx.accountingInvoice.update).mockResolvedValue({ id: "capture-1", reconciliationStatus: "LINKED" } as any)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined as any)
  })

  it("allows PARTNER to resolve a paid invoice incident without changing its payment", async () => {
    const response = await PATCH(request({ reason: "Diferencia de céntimos revisada" }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ message: "Incidencia resuelta", invoice: { workflowStatus: "CONFIRMED", paymentStatus: "PAGADA" } })
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workflowStatus: "CONFIRMED" }) }))
    expect(tx.accountingInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: { reconciliationStatus: "LINKED" } }))
    expect(auditPaymentEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "FACTURA_INCIDENCIA_RESUELTA", reason: "Diferencia de céntimos revisada" }))
  })

  it("rejects users without accounting access and invoices without an incident", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await PATCH(request({ reason: "Revisada" }), context)).status).toBe(403)

    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({ id: "invoice-1", workflowStatus: "DRAFT" } as any)
    expect((await PATCH(request({ reason: "Revisada" }), context)).status).toBe(409)
  })
})
