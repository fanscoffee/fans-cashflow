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

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    webAuthnChallenge: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))

import "../auth"
import { prisma } from "../prisma"

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

  it("invalidates JWTs after a password reset", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ authVersion: 2, id: "user-1", email: "user@example.com", name: "User", role: "EMPLEADO" } as any)

    const token = await captured.options.callbacks.jwt({
      token: { id: "user-1", role: "EMPLEADO", authVersion: 1 },
    })

    expect(token.id).toBeUndefined()
    expect(token.role).toBeUndefined()
  })
})
