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
    coupon: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { PATCH, DELETE } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("Orders API /api/encargos/[orderId]", () => {
  const mockParams = Promise.resolve({ orderId: "o1" })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await PATCH(new Request("http://localhost/api/encargos/o1", { method: "PATCH" }) as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(401)
    })

    it("returns 403 for EMPLEADO updating non-status fields", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      const res = await PATCH(new Request("http://localhost/api/encargos/o1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName: "Hacked" }) }) as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(403)
    })

    it("returns 404 when order not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const body = JSON.stringify({ clientName: "Updated" })
      const req = new Request("http://localhost/api/encargos/o1", {
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

      const body = JSON.stringify({ deliveryLocation: "CAFETERIA" })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryLocation: "CAFETERIA" }),
        })
      )
    })

    it("returns 403 for EMPLEADO updating delivery location", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)

      const body = JSON.stringify({ deliveryLocation: "CAFETERIA" })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(403)
    })

  it("updates order for PARTNER role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "3", role: "SOCIO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.update).mockResolvedValue({ id: "o1" } as any)

      const body = JSON.stringify({ clientName: "Updated" })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
    })

    it("allows EMPLEADO to update isPaid", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.update).mockResolvedValue({ id: "o1", isPaid: true } as any)

      const body = JSON.stringify({ isPaid: true })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPaid: true }) })
      )
    })

    it("allows EMPLEADO to update isDelivered", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.update).mockResolvedValue({ id: "o1", isDelivered: true } as any)

      const body = JSON.stringify({ isDelivered: true })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDelivered: true }) })
      )
    })

    it("generates a pending coupon when an order changes to delivered", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "o1",
        isDelivered: false,
        deliveredAt: null,
      } as any)
      const txOrder = {
        update: vi.fn().mockResolvedValue({ id: "o1", clientName: "Juan" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "o1",
          clientName: "Juan",
          coupon: { code: "TARTA15-JUAN-ABC123" },
        }),
      }
      const txCoupon = {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "c1" }),
      }
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
        callback({ order: txOrder, coupon: txCoupon })
      )

      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDelivered: true }),
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })

      expect(res.status).toBe(200)
      expect(txCoupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: "o1",
            scheduledFor: expect.any(Date),
            nextAttemptAt: null,
            code: expect.stringMatching(/^[A-Z0-9]{4}$/),
            discountPercentage: 10,
          }),
        })
      )
      expect(txOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.not.objectContaining({ coupon: expect.anything() }),
        })
      )
    })

    it("rejects EMPLEADO when updating non-status fields", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)

      const body = JSON.stringify({ clientName: "Hacked" })
      const req = new Request("http://localhost/api/encargos/o1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }) as unknown as NextRequest

      const res = await PATCH(req, { params: mockParams })
      expect(res.status).toBe(403)
    })
  })

  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await DELETE(new Request("http://localhost/api/encargos/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(401)
    })

  it("returns 403 for BAKERY role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "4", role: "OBRADOR" },
      } as any)
      const res = await DELETE(new Request("http://localhost/api/encargos/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(403)
    })

    it("returns 404 when order not found", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const res = await DELETE(new Request("http://localhost/api/encargos/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(404)
    })

    it("deletes order for ADMIN role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({ id: "o1" } as any)
      vi.mocked(prisma.order.delete).mockResolvedValue({ id: "o1" } as any)

      const res = await DELETE(new Request("http://localhost/api/encargos/o1") as unknown as NextRequest, { params: mockParams })
      expect(res.status).toBe(200)
      expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: "o1" } })
    })
  })
})
