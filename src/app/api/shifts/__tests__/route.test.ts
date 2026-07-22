import { describe, expect, it, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    fundAddition: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(url: string, method = "GET", body?: object) {
  const opts: RequestInit = { method }
  if (body) {
    opts.headers = { "Content-Type": "application/json" }
    opts.body = JSON.stringify(body)
  }
  return new Request(url, opts) as unknown as NextRequest
}

describe("Shifts API /api/shifts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await GET(mockRequest("http://localhost/api/shifts"))
      expect(res.status).toBe(401)
    })

    it("returns all shifts for ADMIN", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findMany).mockResolvedValue([
        { id: "s1", turno: "mañana" },
      ] as any)

      const res = await GET(mockRequest("http://localhost/api/shifts"))
      expect(res.status).toBe(200)
      expect(prisma.shift.findMany).toHaveBeenCalled()
    })

    it("returns open and last closed shift for EMPLEADO", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)
      vi.mocked(prisma.shift.findFirst)
        .mockResolvedValueOnce({ id: "open", status: "ABIERTO" } as any)
        .mockResolvedValueOnce({ id: "closed", status: "CERRADO" } as any)

      const res = await GET(mockRequest("http://localhost/api/shifts"))
      expect(res.status).toBe(200)
    })
  })

  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await POST(mockRequest("http://localhost/api/shifts", "POST"))
      expect(res.status).toBe(401)
    })

    it("returns 400 when there is already an open shift", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findFirst).mockResolvedValue({ id: "open" } as any)

      const res = await POST(mockRequest("http://localhost/api/shifts", "POST", {
        date: "2026-07-22", turno: "mañana",
      }))
      expect(res.status).toBe(400)
    })

    it("returns 400 for invalid data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findFirst).mockResolvedValue(null)

      const res = await POST(mockRequest("http://localhost/api/shifts", "POST", {
        date: "2026-07-22", turno: "invalid",
      }))
      expect(res.status).toBe(400)
    })

    it("returns 400 when shift already exists for same date/turno", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findFirst)
        .mockResolvedValueOnce(null) // openShift check
        .mockResolvedValueOnce({ id: "existing" } as any) // existingShift check

      const res = await POST(mockRequest("http://localhost/api/shifts", "POST", {
        date: "2026-07-22", turno: "mañana",
      }))
      expect(res.status).toBe(400)
    })

    it("creates shift with correct fondo", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.shift.findFirst)
        .mockResolvedValueOnce(null) // openShift
        .mockResolvedValueOnce(null) // existingShift
        .mockResolvedValueOnce(null) // lastShift
      vi.mocked(prisma.fundAddition.aggregate).mockResolvedValue({
        _sum: { amount: 200 },
      } as any)
      vi.mocked(prisma.shift.create).mockResolvedValue({
        id: "new", fondoInicial: 200,
      } as any)

      const res = await POST(mockRequest("http://localhost/api/shifts", "POST", {
        date: "2026-07-22", turno: "mañana",
      }))
      expect(res.status).toBe(201)
      expect(prisma.shift.create).toHaveBeenCalled()
    })
  })
})
