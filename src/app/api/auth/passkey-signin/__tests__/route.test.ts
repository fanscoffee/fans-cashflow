import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
}))

import { signIn } from "@/lib/auth"
import { POST } from "../route"

function request(body: unknown) {
  return new Request("http://localhost/api/auth/passkey-signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/passkey-signin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects a user id without a verified challenge", async () => {
    const response = await POST(request({ userId: "admin-user" }))

    expect(response.status).toBe(400)
    expect(signIn).not.toHaveBeenCalled()
  })

  it("only forwards the challenge to the protected provider", async () => {
    vi.mocked(signIn).mockResolvedValue({} as never)
    const challenge = "challenge-value-1234"

    const response = await POST(request({ challenge }))

    expect(response.status).toBe(200)
    expect(signIn).toHaveBeenCalledWith("passkey-credentials", {
      challenge,
      redirect: false,
    })
  })
})
