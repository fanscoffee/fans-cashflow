import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("Orders API /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await GET(mockRequest("http://localhost/api/orders"))
      expect(res.status).toBe(401)
    })

    it("returns orders for ADMIN with month filter", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { id: "o1", clientName: "Test" },
      ] as any)

      const res = await GET(mockRequest("http://localhost/api/orders?month=7&year=2026"))
      expect(res.status).toBe(200)
      expect(prisma.order.findMany).toHaveBeenCalled()
    })

    it("filters by deliveryDate for EMPLEADO", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      await GET(mockRequest("http://localhost/api/orders"))
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deliveryDate: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      )
    })

    it("returns all orders for ADMIN without month filter", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findMany).mockResolvedValue([])

      await GET(mockRequest("http://localhost/api/orders"))
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      )
    })
  })

  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await POST(mockRequest("http://localhost/api/orders"))
      expect(res.status).toBe(401)
    })

    it("returns 400 for invalid data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)

      const body = JSON.stringify({ clientName: "" })
      const req = new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("creates order with valid data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.create).mockResolvedValue({
        id: "o1",
        clientName: "Juan",
      } as any)

      const body = JSON.stringify({
        clientName: "Juan",
        clientPhone: "555-1234",
        deliveryDate: "2026-07-22T14:00:00.000Z",
      })
      const req = new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await POST(req)
      expect(res.status).toBe(201)
      expect(prisma.order.create).toHaveBeenCalled()
    })
  })
})
