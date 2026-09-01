import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const hash = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("bcryptjs", () => ({ default: { hash } }))

import { GET, POST } from "../users/route"
import { PATCH } from "../users/[userId]/route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const adminSession = { user: { id: "admin-1", role: "ADMIN" } }
const context = { params: Promise.resolve({ userId: "user-2" }) }

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("admin user routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(adminSession as any)
    vi.mocked(hash).mockResolvedValue("hashed-password")
  })

  it("lists users only for ADMIN", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "user-1", name: "Ana", email: "ana@example.com", role: "SOCIO" }] as any)

    const response = await GET(jsonRequest("http://localhost/api/admin/users", "GET"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: "user-1", name: "Ana", email: "ana@example.com", role: "SOCIO" }])

    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await GET(jsonRequest("http://localhost/api/admin/users", "GET"))).status).toBe(401)
  })

  it("validates, rejects duplicates and creates users", async () => {
    expect((await POST(jsonRequest("http://localhost/api/admin/users", "POST", {}))).status).toBe(400)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as any)
    const duplicate = await POST(jsonRequest("http://localhost/api/admin/users", "POST", {
      name: "Ana García",
      email: "ana@example.com",
      password: "secret1",
      role: "SOCIO",
    }))
    expect(duplicate.status).toBe(400)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-2", name: "Ana García", email: "ana@example.com", role: "SOCIO" } as any)
    const response = await POST(jsonRequest("http://localhost/api/admin/users", "POST", {
      name: "Ana García",
      email: "ana@example.com",
      password: "secret1",
      role: "SOCIO",
    }))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ id: "user-2", email: "ana@example.com" })
    expect(hash).toHaveBeenCalledWith("secret1", 10)
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ password: "hashed-password" }),
    }))
  })

  it("returns a server error when user creation fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("insert failed"))

    const response = await POST(jsonRequest("http://localhost/api/admin/users", "POST", {
      name: "Ana García",
      email: "ana@example.com",
      password: "secret1",
      role: "SOCIO",
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Error al crear el usuario" })
  })

  it("updates passwords only for ADMIN and never returns the hash", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-2" } as any)
    const response = await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { password: "hashed-password", authVersion: { increment: 1 } },
    })

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)).status).toBe(401)
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "short" }), context)).status).toBe(401)
  })

  it("returns validation and persistence errors while updating a password", async () => {
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "short" }), context)).status).toBe(400)
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("update failed"))
    const response = await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Error al actualizar la contraseña" })
  })
})
