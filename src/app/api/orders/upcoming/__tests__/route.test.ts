import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn() as unknown as () => Promise<null>,
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("Orders Upcoming API /api/orders/upcoming", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns upcoming orders for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "EMPLEADO" },
    } as any)
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      { id: "o1", clientName: "Juan" },
    ] as any)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })

  it("returns empty array when no upcoming orders", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "1", role: "EMPLEADO" },
    } as any)
    vi.mocked(prisma.order.findMany).mockResolvedValue([])

    const res = await GET()
    const data = await res.json()
    expect(data).toEqual([])
  })
})
