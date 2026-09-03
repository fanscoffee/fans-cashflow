import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

describe("DELETE /api/inventario/catalogos/[id]", () => {
  const context = { params: Promise.resolve({ id: "section-1" }) }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(401)
  })

  it("deletes an unused section permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "SECCION", value: "Panadería" } as any)
    vi.mocked(prisma.product.count).mockResolvedValue(0)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1?permanente=true") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(200)
    expect(prisma.catalog.delete).toHaveBeenCalledWith({ where: { id: "section-1" } })
  })

  it("rejects permanent deletion when products use the section", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "SECCION", value: "Panadería" } as any)
    vi.mocked(prisma.product.count).mockResolvedValue(2)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/section-1?permanente=true") as unknown as NextRequest,
      context,
    )

    expect(response.status).toBe(409)
    expect(prisma.catalog.delete).not.toHaveBeenCalled()
  })

  it("deletes an unused family permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "FAMILIA", value: "Pan" } as any)
    vi.mocked(prisma.product.count).mockResolvedValue(0)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/family-1?permanente=true") as unknown as NextRequest,
      { params: Promise.resolve({ id: "family-1" }) },
    )

    expect(response.status).toBe(200)
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { OR: [{ family: "Pan" }] } })
    expect(prisma.catalog.delete).toHaveBeenCalledWith({ where: { id: "family-1" } })
  })

  it("deletes an unused provider catalog entry permanently", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "PROVEEDOR", value: "Proveedor local" } as any)

    const response = await DELETE(
      new Request("http://localhost/api/inventario/catalogos/provider-1?permanente=true") as unknown as NextRequest,
      { params: Promise.resolve({ id: "provider-1" }) },
    )

    expect(response.status).toBe(200)
    expect(prisma.product.count).not.toHaveBeenCalled()
    expect(prisma.catalog.delete).toHaveBeenCalledWith({ where: { id: "provider-1" } })
  })
})

describe("PATCH /api/inventario/catalogos/[id]", () => {
  const context = { params: Promise.resolve({ id: "family-1" }) }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "FAMILIA", value: "Harinas", codePrefix: "HAR" } as any)
    vi.mocked(prisma.catalog.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.product.count).mockResolvedValue(0)
    vi.mocked(prisma.catalog.update).mockResolvedValue({ id: "family-1", value: "Harinas nuevas", codePrefix: "SEM" } as any)
  })

  it("normalizes a family prefix and updates an unused catalog entry", async () => {
    const response = await PATCH(new Request("http://localhost/api/inventario/catalogos/family-1", {
      method: "PATCH",
      body: JSON.stringify({ type: "FAMILIA", value: "Harinas nuevas", codePrefix: " sem " }),
    }) as unknown as NextRequest, context)

    expect(response.status).toBe(200)
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { family: "Harinas" } })
    expect(prisma.catalog.update).toHaveBeenCalledWith({
      where: { id: "family-1" },
      data: { type: "FAMILIA", value: "Harinas nuevas", codePrefix: "SEM" },
    })
  })

  it("rejects invalid prefixes, duplicate values and linked family changes", async () => {
    const request = (body: unknown) => new Request("http://localhost/api/inventario/catalogos/family-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }) as unknown as NextRequest

    vi.mocked(prisma.catalog.findUnique).mockResolvedValueOnce(null)
    expect((await PATCH(request({}), context)).status).toBe(404)

    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "SECCION", value: "Pan", codePrefix: null } as any)
    expect((await PATCH(request({ codePrefix: "PAN" }), context)).status).toBe(400)

    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "FAMILIA", value: "Pan", codePrefix: "PAN" } as any)
    expect((await PATCH(request({ codePrefix: "P" }), context)).status).toBe(400)

    vi.mocked(prisma.catalog.findUnique).mockResolvedValue({ type: "FAMILIA", value: "Pan", codePrefix: "PAN" } as any)
    vi.mocked(prisma.product.count).mockResolvedValue(2)
    expect((await PATCH(request({ codePrefix: "HAR" }), context)).status).toBe(409)

    vi.mocked(prisma.product.count).mockResolvedValue(0)
    vi.mocked(prisma.catalog.findFirst).mockResolvedValue({ id: "other" } as any)
    expect((await PATCH(request({ value: "Otro valor" }), context)).status).toBe(400)
  })

  it("soft deletes entries and protects the delete operation by role", async () => {
    const request = new Request("http://localhost/api/inventario/catalogos/family-1", { method: "DELETE" }) as unknown as NextRequest
    vi.mocked(prisma.catalog.update).mockResolvedValue({ id: "family-1", active: false } as any)

    const response = await DELETE(request, context)
    expect(response.status).toBe(200)
    expect(prisma.catalog.update).toHaveBeenCalledWith({ where: { id: "family-1" }, data: { active: false } })

    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await DELETE(request, context)).status).toBe(403)
  })
})
