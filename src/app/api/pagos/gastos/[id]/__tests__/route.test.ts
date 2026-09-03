import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/payments", () => ({
  deleteCurrentExpense: vi.fn(),
}))

vi.mock("@/lib/payments-http", () => ({
  paymentErrorResponse: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE } from "../route"
import { deleteCurrentExpense } from "@/lib/payments"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "expense-1" }) }
const request = new Request("http://localhost/api/pagos/gastos/expense-1", { method: "DELETE" }) as unknown as NextRequest

describe("DELETE /api/pagos/gastos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
  })

  it("deletes the requested current expense", async () => {
    vi.mocked(deleteCurrentExpense).mockResolvedValue({ id: "expense-1", status: "ANULADO" } as any)

    const response = await DELETE(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, expense: { id: "expense-1", status: "ANULADO" } })
    expect(deleteCurrentExpense).toHaveBeenCalledWith({ id: "partner-1", role: "SOCIO" }, "expense-1")
  })
})
