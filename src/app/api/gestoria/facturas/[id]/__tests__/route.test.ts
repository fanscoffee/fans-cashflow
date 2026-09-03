import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingInvoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "gestoria-1" }) }
const request = (method = "GET", body?: unknown) => new Request("http://localhost/api/gestoria/facturas/gestoria-1", { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }) as unknown as NextRequest

const body = {
  date: "2026-07-15",
  invoiceNumber: "CAP-1",
  supplierOrCreditor: "Proveedor",
  taxId: "B12345678",
  concept: "SERVICIO",
  exemptBase: 0,
  base21: 100,
  vat21: 21,
  base10: 0,
  vat10: 0,
  base4: 0,
  vat4: 0,
  base2: 0,
  vat2: 0,
  totalBase: 100,
  totalVat: 21,
  withholdingTax: 0,
  invoiceTotal: 121,
  paymentMethod: "BANCO",
  ocrText: "texto",
  source: "OCR",
}

const stored = {
  id: "gestoria-1",
  date: new Date("2026-07-15T00:00:00.000Z"),
  invoiceTotal: 121,
  createdById: "admin-1",
  alerts: null,
}

describe("/api/gestoria/facturas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.accountingInvoice.findUnique).mockResolvedValue(stored as any)
    vi.mocked(prisma.accountingInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.accountingInvoice.update).mockResolvedValue(stored as any)
    vi.mocked(prisma.accountingInvoice.delete).mockResolvedValue({ id: "gestoria-1" } as any)
  })

  it("reads, updates and deletes standalone captures", async () => {
    expect((await GET(request(), context)).status).toBe(200)
    expect((await PATCH(request("PATCH", body), context)).status).toBe(200)
    expect((await DELETE(request("DELETE"), context)).status).toBe(200)
    expect(prisma.accountingInvoice.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "gestoria-1" }, data: expect.objectContaining({ createdById: "admin-1", invoiceTotal: 121 }) }))
    expect(prisma.accountingInvoice.delete).toHaveBeenCalledWith({ where: { id: "gestoria-1" }, select: { id: true } })
  })

  it("rejects users without accounting access", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request(), context)).status).toBe(403)
    expect((await PATCH(request("PATCH", body), context)).status).toBe(403)
    expect((await DELETE(request("DELETE"), context)).status).toBe(403)
  })
})
