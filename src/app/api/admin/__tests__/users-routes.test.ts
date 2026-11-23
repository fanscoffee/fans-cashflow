import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const hash = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("bcryptjs", async (importOriginal) => {
  const bcrypt = await importOriginal<typeof import("bcryptjs")>()
  return { default: { ...bcrypt.default, hash } }
})

import { GET, POST } from "../users/route"
import { DELETE, PATCH } from "../users/[userId]/route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FIRST_REACTIVATED_AUTH_VERSION } from "@/lib/user-access"

const adminSession = { user: { id: "admin-1", role: "ADMIN" } }
const context = { params: Promise.resolve({ userId: "user-2" }) }
const deleteRequest = () => jsonRequest("http://localhost/api/admin/users/user-2", "DELETE")
const reactivateRequest = (body: unknown = { password: "new-secret", reactivate: true }) =>
  jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", body)
const accessTransaction = {
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  webAuthnChallenge: { deleteMany: vi.fn() },
  passkey: { deleteMany: vi.fn() },
  auditEvent: { create: vi.fn() },
}

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
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", name: "Ana", email: "ana@example.com", role: "SOCIO", authVersion: 3 },
      { id: "user-2", name: "Eva", email: "eva@example.com", role: "EMPLEADO", authVersion: -1 },
    ] as any)

    const response = await GET(jsonRequest("http://localhost/api/admin/users", "GET"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { id: "user-1", name: "Ana", email: "ana@example.com", role: "SOCIO", accessRevoked: false },
      { id: "user-2", name: "Eva", email: "eva@example.com", role: "EMPLEADO", accessRevoked: true },
    ])
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, name: true, email: true, role: true, authVersion: true },
    }))

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
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 })
    const response = await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-2", authVersion: { gte: 0 } },
      data: { password: "hashed-password", authVersion: { increment: 1 } },
    })

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)).status).toBe(401)
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "short" }), context)).status).toBe(401)
  })

  it("returns validation and persistence errors while updating a password", async () => {
    expect((await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "short" }), context)).status).toBe(400)
    vi.mocked(prisma.user.updateMany).mockRejectedValueOnce(new Error("update failed"))
    const response = await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Error al actualizar la contraseña" })
  })

  it("cannot reactivate an account by changing its password", async () => {
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 0 })
    const response = await PATCH(jsonRequest("http://localhost/api/admin/users/user-2", "PATCH", { password: "new-secret" }), context)
    expect(response.status).toBe(404)
  })
})

describe("changing account access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(adminSession as any)
    hash.mockResolvedValue("hashed-password")
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(accessTransaction))
    accessTransaction.user.findUnique.mockResolvedValue({ authVersion: 4 })
    accessTransaction.user.updateMany.mockResolvedValue({ count: 1 })
  })

  it("revokes access, removes credentials and records the action without deleting the user", async () => {
    const response = await DELETE(deleteRequest(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(accessTransaction.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-2", role: { in: ["EMPLOYEE", "PARTNER", "BAKERY"] }, authVersion: { gte: 0 } },
      select: { authVersion: true },
    })
    expect(accessTransaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-2", role: { in: ["EMPLOYEE", "PARTNER", "BAKERY"] }, authVersion: 4 },
      data: { authVersion: -5, password: "!" },
    })
    expect(accessTransaction.webAuthnChallenge.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: "user-2" }, { verifiedUserId: "user-2" }] },
    })
    expect(accessTransaction.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-2" } })
    expect(accessTransaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { actorId: "admin-1", action: "USUARIO_ACCESO_REVOCADO", recordType: "User", recordId: "user-2" },
    }))
  })

  it("requires authentication and the admin role", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    expect((await DELETE(deleteRequest(), context)).status).toBe(401)
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await DELETE(deleteRequest(), context)).status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects revoking the administrator's own account", async () => {
    const selfContext = { params: Promise.resolve({ userId: adminSession.user.id }) }
    expect((await DELETE(deleteRequest(), selfContext)).status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("leaves admin, missing and previously revoked users unchanged", async () => {
    accessTransaction.user.findUnique.mockResolvedValueOnce(null)
    expect((await DELETE(deleteRequest(), context)).status).toBe(404)
    expect(accessTransaction.user.updateMany).not.toHaveBeenCalled()
    expect(accessTransaction.passkey.deleteMany).not.toHaveBeenCalled()
    expect(accessTransaction.auditEvent.create).not.toHaveBeenCalled()
  })

  it("does not report success when the revocation transaction fails", async () => {
    accessTransaction.passkey.deleteMany.mockRejectedValueOnce(new Error("database error"))
    const response = await DELETE(deleteRequest(), context)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Error al eliminar el acceso" })
    expect(accessTransaction.auditEvent.create).not.toHaveBeenCalled()
  })

  it.each([
    [-1, FIRST_REACTIVATED_AUTH_VERSION],
    [-(FIRST_REACTIVATED_AUTH_VERSION + 1), FIRST_REACTIVATED_AUTH_VERSION + 1],
  ])("reactivates a revoked account with password rotation and a fresh session version (%d)", async (revokedVersion, restoredVersion) => {
    accessTransaction.user.findUnique.mockResolvedValueOnce({ authVersion: revokedVersion })
    const response = await PATCH(reactivateRequest(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(hash).toHaveBeenCalledWith("new-secret", 10)
    expect(accessTransaction.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-2", role: { in: ["EMPLOYEE", "PARTNER", "BAKERY"] }, authVersion: { lt: 0 } },
      select: { authVersion: true },
    })
    expect(accessTransaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-2", role: { in: ["EMPLOYEE", "PARTNER", "BAKERY"] }, authVersion: revokedVersion },
      data: { authVersion: restoredVersion, password: "hashed-password" },
    })
    expect(accessTransaction.webAuthnChallenge.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: "user-2" }, { verifiedUserId: "user-2" }] },
    })
    expect(accessTransaction.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-2" } })
    expect(accessTransaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { actorId: "admin-1", action: "USUARIO_ACCESO_REACTIVADO", recordType: "User", recordId: "user-2" },
    }))
  })

  it("requires an admin to reactivate an account and blocks self-reactivation", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    expect((await PATCH(reactivateRequest(), context)).status).toBe(401)
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "partner-1", role: "SOCIO" } } as any)
    expect((await PATCH(reactivateRequest(), context)).status).toBe(401)
    expect((await PATCH(reactivateRequest(), { params: Promise.resolve({ userId: adminSession.user.id }) })).status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([undefined, "short", "      ", "á".repeat(37)])("requires a valid new password (%s)", async (password) => {
    const response = await PATCH(reactivateRequest({ password, reactivate: true }), context)
    expect(response.status).toBe(400)
    expect(hash).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("does not reactivate active, admin or missing accounts", async () => {
    accessTransaction.user.findUnique.mockResolvedValueOnce(null)
    expect((await PATCH(reactivateRequest(), context)).status).toBe(404)
    expect(accessTransaction.user.updateMany).not.toHaveBeenCalled()
    expect(accessTransaction.auditEvent.create).not.toHaveBeenCalled()
  })

  it("does not change credentials when the status changed concurrently", async () => {
    accessTransaction.user.findUnique.mockResolvedValueOnce({ authVersion: -5 })
    accessTransaction.user.updateMany.mockResolvedValueOnce({ count: 0 })

    expect((await PATCH(reactivateRequest(), context)).status).toBe(409)
    expect(accessTransaction.passkey.deleteMany).not.toHaveBeenCalled()
    expect(accessTransaction.auditEvent.create).not.toHaveBeenCalled()
  })
})
