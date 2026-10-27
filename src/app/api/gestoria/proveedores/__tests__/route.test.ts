import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const request = (url: string) => new Request(url) as unknown as NextRequest

describe("GET /api/gestoria/proveedores", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.supplier.findMany).mockResolvedValue([
      { id: "supplier-1", legalName: "Cafés Candelas, SLU", taxId: "B27013713" },
    ] as any)
  })

  it("requires accounting access", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await GET(request("http://localhost/api/gestoria/proveedores?search=cafe"))

    expect(response.status).toBe(403)
    expect(prisma.supplier.findMany).not.toHaveBeenCalled()
  })

  it("searches suppliers by name or tax id and returns only selection fields", async () => {
    const response = await GET(request("http://localhost/api/gestoria/proveedores?search=B270"))

    expect(response.status).toBe(200)
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { legalName: { contains: "B270", mode: "insensitive" } },
          { taxId: { contains: "B270", mode: "insensitive" } },
        ],
      },
      select: { id: true, legalName: true, taxId: true },
      orderBy: { legalName: "asc" },
    })
    await expect(response.json()).resolves.toEqual({ suppliers: [{ id: "supplier-1", legalName: "Cafés Candelas, SLU", taxId: "B27013713" }] })
  })
})
