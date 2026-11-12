import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountingInvoice: { findUnique: vi.fn(), updateMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    receipt: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "capture-1" }) }
const request = new Request("http://localhost/api/gestoria/facturas/capture-1/sugerencias") as unknown as NextRequest
const capture = {
  id: "capture-1",
  date: new Date("2026-08-01T00:00:00.000Z"),
  invoiceNumber: "A/42",
  supplierOrCreditor: "Proveedor Uno",
  taxId: "B12345678",
  concept: "COMPRA",
  exemptBase: 0,
  base21: 10,
  vat21: 2.1,
  base10: 0,
  vat10: 0,
  base4: 0,
  vat4: 0,
  base2: 0,
  vat2: 0,
  totalBase: 10,
  totalVat: 2.1,
  withholdingTax: 0,
  invoiceTotal: 12.1,
  paymentMethod: "TRANSFERENCIA",
  documentType: null,
  reconciliationStatus: "UNLINKED",
  supplierId: null,
  inventoryInvoiceId: null,
  alerts: null,
  supplier: null,
  inventoryInvoice: null,
}
const supplier = { id: "supplier-1", legalName: "Proveedor Uno", taxId: "B12345678", billingAddress: "Calle Mayor 1" }
const receipt = {
  id: "receipt-1",
  deliveryNoteCode: "ALB-1",
  supplierId: "supplier-1",
  receivedAt: new Date("2026-08-01T00:00:00.000Z"),
  transportCost: 0,
  lines: [{ productId: "product-1", receivedQuantity: 2, unitPrice: 5, batch: null, dueDate: null, product: { code: "P-1", posDescription: "Harina", purchaseUnit: "kg", purchaseVatPercentage: 21 } }],
}

describe("GET /api/gestoria/facturas/[id]/sugerencias", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.accountingInvoice.findUnique).mockResolvedValue(capture as any)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([supplier] as any)
    vi.mocked(prisma.receipt.findMany).mockResolvedValue([receipt] as any)
    vi.mocked(prisma.accountingInvoice.updateMany).mockResolvedValue({ count: 1 } as any)
  })

  it("resolves the supplier, scores free receipts and marks a suggestion", async () => {
    const response = await GET(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: "SUGGESTED",
      supplier: { id: "supplier-1" },
      suggestedReceiptIds: ["receipt-1"],
      deliveryNotes: [{ id: "receipt-1", score: 80 }],
    })
    expect(prisma.accountingInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { supplierId: "supplier-1", reconciliationStatus: "SUGGESTED" } }))
  })

  it("rejects unauthorized users", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    expect((await GET(request, context)).status).toBe(403)
    expect(prisma.accountingInvoice.findUnique).not.toHaveBeenCalled()
  })

  it("marks expense captures as not applicable instead of suggesting receptions", async () => {
    vi.mocked(prisma.accountingInvoice.findUnique).mockResolvedValue({ ...capture, documentType: "EXPENSE" } as any)

    const response = await GET(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: "NOT_APPLICABLE", deliveryNotes: [], suggestedReceiptIds: [] })
    expect(prisma.accountingInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reconciliationStatus: "NOT_APPLICABLE" } }))
  })
})
