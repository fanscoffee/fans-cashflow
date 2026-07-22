import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findFirst: vi.fn(),
    },
    fundAddition: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function mockRequest(url: string) {
  return new Request(url) as unknown as Request
}

describe("Fund API /api/fund", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await GET(mockRequest("http://localhost/api/fund"))
    expect(res.status).toBe(401)
  })

  it("returns fondo based on last shift and additions", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findFirst).mockResolvedValue({
      id: "s1",
      fondoFinal: 500,
      createdAt: new Date("2026-07-20"),
    } as any)
    vi.mocked(prisma.fundAddition.aggregate).mockResolvedValue({
      _sum: { amount: 150 },
    } as any)

    const res = await GET(mockRequest("http://localhost/api/fund"))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.fondo).toBe(650)
  })

  it("returns 0 when no shifts and no additions", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    } as any)
    vi.mocked(prisma.shift.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.fundAddition.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as any)

    const res = await GET(mockRequest("http://localhost/api/fund"))
    const data = await res.json()
    expect(data.fondo).toBe(0)
  })
})
