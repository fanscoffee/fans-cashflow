import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const createProductionEntry = vi.hoisted(() => vi.fn())

vi.mock("@/lib/production-control", () => ({ createProductionEntry }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { POST } from "../route"
import { auth } from "@/lib/auth"

describe("POST /api/inventario/produccion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    createProductionEntry.mockResolvedValue({ id: "production-1" })
  })

  it("uses the authenticated user and forwards valid production data", async () => {
    const response = await POST(new Request("http://localhost/api/inventario/produccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: "shift-1", productId: "product-1", quantity: 4 }),
    }) as unknown as NextRequest)

    expect(response.status).toBe(201)
    expect(createProductionEntry).toHaveBeenCalledWith(
      { id: "employee-1", role: "EMPLEADO" },
      expect.objectContaining({ shiftId: "shift-1", productId: "product-1", quantity: 4 }),
    )
  })

  it("rejects non-positive quantities before calling the domain service", async () => {
    const response = await POST(new Request("http://localhost/api/inventario/produccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: "shift-1", productId: "product-1", quantity: 0 }),
    }) as unknown as NextRequest)

    expect(response.status).toBe(400)
    expect(createProductionEntry).not.toHaveBeenCalled()
  })
})
