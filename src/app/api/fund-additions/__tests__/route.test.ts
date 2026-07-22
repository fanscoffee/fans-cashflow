import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fundAddition: {
      findMany: vi.fn(),
      create: vi.fn(),
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
  return new Request(url, opts) as unknown as Request
}

describe("Fund Additions API /api/fund-additions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await GET(mockRequest("http://localhost/api/fund-additions"))
      expect(res.status).toBe(401)
    })

    it("returns additions list", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)
      vi.mocked(prisma.fundAddition.findMany).mockResolvedValue([
        { id: "a1", amount: 100 },
      ] as any)

      const res = await GET(mockRequest("http://localhost/api/fund-additions"))
      expect(res.status).toBe(200)
    })
  })

  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as any)
      const res = await POST(mockRequest("http://localhost/api/fund-additions", "POST"))
      expect(res.status).toBe(401)
    })

    it("returns 403 for EMPLEADO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "2", role: "EMPLEADO" },
      } as any)

      const res = await POST(mockRequest("http://localhost/api/fund-additions", "POST", {
        amount: 100,
      }))
      expect(res.status).toBe(403)
    })

    it("creates addition for SOCIO role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "3", role: "SOCIO" },
      } as any)
      vi.mocked(prisma.fundAddition.create).mockResolvedValue({
        id: "a1", amount: 100,
      } as any)

      const res = await POST(mockRequest("http://localhost/api/fund-additions", "POST", {
        amount: 100, description: "Test",
      }))
      expect(res.status).toBe(201)
    })

    it("returns 400 for invalid data", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "1", role: "ADMIN" },
      } as any)

      const res = await POST(mockRequest("http://localhost/api/fund-additions", "POST", {
        amount: -5,
      }))
      expect(res.status).toBe(400)
    })
  })
})
