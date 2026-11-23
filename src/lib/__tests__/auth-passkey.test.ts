import { beforeEach, describe, expect, it, vi } from "vitest"

const captured = vi.hoisted(() => ({ options: null as any }))

vi.mock("next-auth", () => ({
  default: vi.fn((options: any) => {
    captured.options = options
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }
  }),
}))

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}))

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}))

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    webAuthnChallenge: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))

import "../auth"
import bcrypt from "bcryptjs"
import { prisma } from "../prisma"
import { FIRST_REACTIVATED_AUTH_VERSION } from "../user-access"

describe("passkey NextAuth provider", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does not authenticate from a user id alone", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.id === "passkey-credentials")
    expect(provider).toBeDefined()

    await expect(provider.options.authorize({ userId: "admin-user" })).resolves.toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("uses the user bound to a verified one-time challenge", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.id === "passkey-credentials")
    expect(provider).toBeDefined()
    vi.mocked(prisma.webAuthnChallenge.findFirst).mockResolvedValue({ id: "grant-1", verifiedUserId: "real-user" } as any)
    vi.mocked(prisma.webAuthnChallenge.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "real-user", email: "real@example.com", name: "Real", role: "EMPLEADO", authVersion: 0 } as any)

    await expect(provider.options.authorize({ challenge: "challenge-value", userId: "attacker" })).resolves.toMatchObject({
      id: "real-user",
      email: "real@example.com",
    })
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "real-user" } })
  })

  it("blocks passkey sign-in for a revoked user even if a verified challenge remains", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.id === "passkey-credentials")
    vi.mocked(prisma.webAuthnChallenge.findFirst).mockResolvedValue({ id: "grant-1", verifiedUserId: "staff-1" } as any)
    vi.mocked(prisma.webAuthnChallenge.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-1", authVersion: -1 } as any)

    await expect(provider.options.authorize({ challenge: "verified-challenge" })).resolves.toBeNull()
  })

  it("does not issue a login if an access change removed the passkey challenge", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.id === "passkey-credentials")
    vi.mocked(prisma.webAuthnChallenge.findFirst).mockResolvedValue({ id: "grant-1", verifiedUserId: "staff-1" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-1", authVersion: 4 } as any)
    vi.mocked(prisma.webAuthnChallenge.updateMany).mockResolvedValue({ count: 0 })

    await expect(provider.options.authorize({ challenge: "removed-challenge" })).resolves.toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledBefore(vi.mocked(prisma.webAuthnChallenge.updateMany))
  })
})

describe("account access and JWT sessions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("blocks password sign-in for revoked users without checking the password", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.credentials?.password)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "staff-1", password: "old-hash", authVersion: -1 } as any)

    await expect(provider.options.authorize({
      email: "staff@example.com", password: "previous-password",
    }, new Request("http://localhost"))).resolves.toBeNull()
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it("keeps sessions valid for users who still have access", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ authVersion: 1, id: "staff-1", email: "staff@example.com", name: "Staff", role: "EMPLEADO" } as any)

    await expect(captured.options.callbacks.jwt({
      token: { id: "staff-1", authVersion: 1 },
    })).resolves.toMatchObject({ id: "staff-1", role: "EMPLEADO", authVersion: 1 })
  })

  it("invalidates JWTs after a password reset", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ authVersion: 2, id: "user-1", email: "user@example.com", name: "User", role: "EMPLEADO" } as any)

    await expect(captured.options.callbacks.jwt({
      token: { id: "user-1", role: "EMPLEADO", authVersion: 1 },
    })).resolves.toBeNull()
  })

  it.each([undefined, 0, -1])("invalidates sessions for a revoked user (token version: %s)", async (authVersion) => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ authVersion: -1, id: "staff-1", role: "EMPLEADO" } as any)

    await expect(captured.options.callbacks.jwt({
      token: { id: "staff-1", role: "EMPLEADO", authVersion },
    })).resolves.toBeNull()
  })

  it("allows a fresh sign-in after reactivation but keeps pre-revocation sessions invalid", async () => {
    const provider = captured.options.providers.find((item: any) => item.options?.credentials?.password)
    const restoredUser = {
      id: "staff-1", email: "staff@example.com", name: "Staff", role: "EMPLEADO",
      password: "replacement-hash", authVersion: FIRST_REACTIVATED_AUTH_VERSION,
    }
    vi.mocked(prisma.user.findUnique).mockResolvedValue(restoredUser as any)
    vi.mocked(bcrypt.compare).mockImplementation(((_password: string, hash: string) =>
      Promise.resolve(_password === "new-secret" && hash === restoredUser.password)) as typeof bcrypt.compare)
    const request = new Request("http://localhost")

    for (const authVersion of [undefined, 4, FIRST_REACTIVATED_AUTH_VERSION]) {
      await expect(captured.options.callbacks.jwt({
        token: { id: restoredUser.id, authVersion },
      })).resolves.toBeNull()
    }

    await expect(provider.options.authorize({ email: restoredUser.email, password: "old-secret" }, request)).resolves.toBeNull()
    const user = await provider.options.authorize({ email: restoredUser.email, password: "new-secret" }, request)
    const fresh = await captured.options.callbacks.jwt({ token: {}, user })
    expect(fresh).toMatchObject({
      id: restoredUser.id, authVersion: FIRST_REACTIVATED_AUTH_VERSION, reactivatedAccess: true,
    })
    await expect(captured.options.callbacks.jwt({ token: fresh })).resolves.toMatchObject({ id: restoredUser.id })

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...restoredUser, authVersion: FIRST_REACTIVATED_AUTH_VERSION + 1 } as any)
    await expect(captured.options.callbacks.jwt({ token: fresh })).resolves.toBeNull()
  })
})
