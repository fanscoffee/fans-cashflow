import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingInvoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const request = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-15",
    invoiceNumber: "CAP-1",
    supplierOrCreditor: "Proveedor independiente",
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
    ...overrides,
  }
}

const storedInvoice = {
  id: "gestoria-1",
  date: new Date("2026-07-15T00:00:00.000Z"),
  invoiceNumber: "CAP-1",
  supplierOrCreditor: "Proveedor independiente",
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
  alerts: null,
  createdById: "admin-1",
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  createdBy: { name: "Admin", email: "admin@example.com" },
}

describe("GET/POST /api/gestoria/facturas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.accountingInvoice.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.accountingInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.accountingInvoice.count).mockResolvedValue(0)
    vi.mocked(prisma.accountingInvoice.create).mockResolvedValue(storedInvoice as any)
  })

  it("requires authentication and accounting access", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    expect((await GET(request("http://localhost/api/gestoria/facturas"))).status).toBe(401)

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request("http://localhost/api/gestoria/facturas"))).status).toBe(403)
  })

  it("lists captures for an allowed user", async () => {
    vi.mocked(prisma.accountingInvoice.findMany).mockResolvedValue([storedInvoice] as any)
    vi.mocked(prisma.accountingInvoice.count).mockResolvedValue(1)
    const response = await GET(request("http://localhost/api/gestoria/facturas?search=CAP-1"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ total: 1, invoices: [{ id: "gestoria-1", invoiceTotal: 121, date: "2026-07-15T00:00:00.000Z" }] })
  })

  it("creates a standalone capture and returns duplicate warnings without blocking", async () => {
    vi.mocked(prisma.accountingInvoice.findFirst).mockResolvedValue({ id: "other" } as any)
    const response = await POST(request("http://localhost/api/gestoria/facturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody()) }))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ invoice: { id: "gestoria-1" }, alerts: ["Posible duplicado: ya existe una factura con el mismo NIF y número"] })
    expect(prisma.accountingInvoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supplierOrCreditor: "Proveedor independiente", taxId: "B12345678", invoiceTotal: 121, createdById: "admin-1" }) }))
  })

  it("rejects captures missing required fields", async () => {
    const response = await POST(request("http://localhost/api/gestoria/facturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody({ date: "", supplierOrCreditor: "", invoiceTotal: "" })) }))
    expect(response.status).toBe(400)
    expect(prisma.accountingInvoice.create).not.toHaveBeenCalled()
  })
})
