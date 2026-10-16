import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function request(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("GET /api/gestoria/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.shift.findMany).mockResolvedValue([])
  })

  it("requires authentication and an allowed role", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    expect((await GET(request("http://localhost/api/gestoria/tickets"))).status).toBe(401)

    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "EMPLEADO" } } as any)
    expect((await GET(request("http://localhost/api/gestoria/tickets"))).status).toBe(403)
  })

  it("rejects invalid periods", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "ADMIN" } } as any)
    const response = await GET(request("http://localhost/api/gestoria/tickets?month=13&year=2026"))

    expect(response.status).toBe(400)
    expect(prisma.shift.findMany).not.toHaveBeenCalled()
  })

  it("returns ticket values for closed shifts in the requested month", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "SOCIO" } } as any)
    vi.mocked(prisma.shift.findMany).mockResolvedValue([
      {
        id: "shift-1",
        date: new Date("2026-07-22T00:00:00.000Z"),
        shiftClose: {
          cashCloseNumber: "1695",
          cashSales: "420.00",
          cardSales: "758.45",
          breadVat4Base: "28.08",
          breadVat4Amount: "1.12",
          vat10Base: "1044.80",
          vat10Amount: "104.45",
        },
      },
    ] as any)

    const response = await GET(request("http://localhost/api/gestoria/tickets?month=7&year=2026"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tickets: [{
        id: "shift-1",
        date: "2026-07-22",
        ticketNumber: "1695",
        cash: 420,
        card: 758.45,
        vat4Base: 28.08,
        vat4: 1.12,
        vat10Base: 1044.8,
        vat10: 104.45,
      }],
    })
    expect(prisma.shift.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: "CERRADO",
        date: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lt: new Date("2026-08-01T00:00:00.000Z"),
        },
        shiftClose: { isNot: null },
      },
    }))
  })
})
