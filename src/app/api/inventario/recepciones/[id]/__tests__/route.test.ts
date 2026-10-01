import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    receipt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "receipt-1" }) }

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/inventario/recepciones/receipt-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const body = {
  supplierId: "provider-1",
  deliveryNoteCode: "ALB-002",
  receivedAt: "2026-10-02",
  notes: "Corregida",
  lines: [{ productId: "product-1", receivedQuantity: 3, unitPrice: 4.5, batch: "LOT-2", dueDate: "2027-01-01" }],
}

describe("PATCH /api/inventario/recepciones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    vi.mocked(prisma.receipt.findUnique).mockResolvedValue({ id: "receipt-1" } as any)
    vi.mocked(prisma.receipt.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.product.findMany).mockResolvedValue([{ id: "product-1" }] as any)
  })

  it("allows SOCIO to update reception header and lines transactionally", async () => {
    const update = vi.fn().mockResolvedValue({ id: "receipt-1" })
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({ receipt: { update } }))

    const response = await PATCH(patchRequest(body), context)

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "receipt-1" },
      data: expect.objectContaining({
        supplierId: "provider-1",
        deliveryNoteCode: "ALB-002",
        lines: {
          deleteMany: {},
          create: [{
            productId: "product-1",
            receivedQuantity: 3,
            unitPrice: 4.5,
            batch: "LOT-2",
            dueDate: new Date("2027-01-01"),
          }],
        },
      }),
    }))
  })

  it("does not allow EMPLEADO to modify a reception", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await PATCH(patchRequest(body), context)

    expect(response.status).toBe(403)
    expect(prisma.receipt.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
