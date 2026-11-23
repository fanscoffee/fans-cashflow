import { beforeEach, describe, expect, it, vi } from "vitest"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { prisma } from "@/lib/prisma"
import { POST as authenticate } from "../authenticate/route"
import { POST as verify } from "../verify/route"

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passkey: { findMany: vi.fn(), findUnique: vi.fn() },
    webAuthnChallenge: { findFirst: vi.fn() },
  },
}))

function request(action: string, body: object) {
  return new Request(`http://localhost/api/passkeys/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("passkey access for revoked accounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("looks up authentication options only for accounts with access", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.passkey.findMany).mockResolvedValue([])

    expect((await authenticate(request("authenticate", { email: "staff@example.com" }))).status).toBe(404)
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "staff@example.com", authVersion: { gte: 0 } },
    }))
    expect((await authenticate(request("authenticate", {}))).status).toBe(404)
    expect(prisma.passkey.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user: { authVersion: { gte: 0 } } },
    }))
  })

  it("refuses to verify a passkey for an account whose access was revoked", async () => {
    const passkey = { id: "key-1", userId: "staff-1", user: { authVersion: -1 } }
    vi.mocked(prisma.passkey.findUnique).mockResolvedValue(passkey as any)

    const response = await verify(request("verify", { credential: { id: "credential-1" }, challenge: "test-challenge-value" }))
    expect(response.status).toBe(404)
    expect(prisma.webAuthnChallenge.findFirst).not.toHaveBeenCalled()
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled()
  })
})
