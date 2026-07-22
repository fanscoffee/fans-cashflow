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

import { PATCH, DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("Orders API /api/orders/[orderId]", () => {
  const mockParams = Promise.resolve({ orderId: "o1" })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await PATCH(new Request("http://localhost/api/orders/o1", { method: "PATCH" }) as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(401)
    })

    it("returns 403 for EMPLEADO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      const res = await PATCH(new Request("http://localhost/api/orders/o1", { method: "PATCH" }) as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(403)
    })

    it("returns 404 when order not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const body = JSON.stringify({ clientName: "Updated" })
      const req = new Request("http://localhost/api/orders/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(404)
    })

    it("updates order for ADMIN role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.update).mockResolvedValue({ id: "o1", clientName: "Updated" } as any)

      const body = JSON.stringify({ clientName: "Updated" })
      const req = new Request("http://localhost/api/orders/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.update).toHaveBeenCalled()
    })

    it("updates order for SOCIO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "3", role: "SOCIO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.update).mockResolvedValue({ id: "o1" } as any)

      const body = JSON.stringify({ clientName: "Updated" })
      const req = new Request("http://localhost/api/orders/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
    })
  })

  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await DELETE(new Request("http://localhost/api/orders/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(401)
    })

    it("returns 403 for OBRADOR role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "4", role: "OBRADOR" },
      } as any)
      const res = await DELETE(new Request("http://localhost/api/orders/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(403)
    })

    it("returns 404 when order not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const res = await DELETE(new Request("http://localhost/api/orders/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(404)
    })

    it("deletes order for ADMIN role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.delete).mockResolvedValue({ id: "o1" } as any)

      const res = await DELETE(new Request("http://localhost/api/orders/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: "o1" } })
    })
  })
})
