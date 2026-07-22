import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findMany: vi.fn(),
    },
    cashTracking: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(url: string, method = "GET", body?: object) {
  const opts: RequestInit = { method }
  if (body) {
    opts.headers = { "Content-Type": "application/json" }
    opts.body = JSON.stringify(body)
  }
  return new Request(url, opts) as unknown as Request
}

describe("Cash Tracking API /api/cash-tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await GET(mockRequest("http://localhost/api/cash-tracking"))
      expect(res.status).toBe(401)
    })

    it("returns 403 for EMPLEADO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)

      const res = await GET(mockRequest("http://localhost/api/cash-tracking"))
      expect(res.status).toBe(403)
    })

    it("returns shifts for ADMIN", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findMany).mockResolvedValue([
        { id: "s1", efectivo: 100 },
      ] as any)

      const res = await GET(mockRequest("http://localhost/api/cash-tracking?month=7&year=2026"))
      expect(res.status).toBe(200)
      expect(prisma.shift.findMany).toHaveBeenCalled()
    })

    it("uses current month when no params", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "SOCIO" },
      } as any)
      vi.mocked(prisma.shift.findMany).mockResolvedValue([])

      const res = await GET(mockRequest("http://localhost/api/cash-tracking"))
      expect(res.status).toBe(200)
    })
  })

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await PATCH(mockRequest("http://localhost/api/cash-tracking", "PATCH"))
      expect(res.status).toBe(401)
    })

    it("returns 403 for EMPLEADO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)

      const res = await PATCH(mockRequest("http://localhost/api/cash-tracking", "PATCH"))
      expect(res.status).toBe(403)
    })

    it("creates new cash tracking", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.cashTracking.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.cashTracking.create).mockResolvedValue({
        id: "ct1", destination: "DEPOSITO",
      } as any)

      const res = await PATCH(mockRequest("http://localhost/api/cash-tracking", "PATCH", {
        shiftId: "s1", destination: "DEPOSITO",
      }))
      expect(res.status).toBe(200)
      expect(prisma.cashTracking.create).toHaveBeenCalled()
    })

    it("updates existing cash tracking", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "SOCIO" },
      } as any)
      vi.mocked(prisma.cashTracking.findUnique).mockResolvedValue({
        id: "ct1", shiftId: "s1",
      } as any)
      vi.mocked(prisma.cashTracking.update).mockResolvedValue({
        id: "ct1", destination: "FANS",
      } as any)

      const res = await PATCH(mockRequest("http://localhost/api/cash-tracking", "PATCH", {
        shiftId: "s1", destination: "FANS",
      }))
      expect(res.status).toBe(200)
      expect(prisma.cashTracking.update).toHaveBeenCalled()
    })

    it("returns 400 for invalid data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)

      const res = await PATCH(mockRequest("http://localhost/api/cash-tracking", "PATCH", {
        shiftId: "s1", destination: "INVALID",
      }))
      expect(res.status).toBe(400)
    })
  })
})
