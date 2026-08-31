import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { POST } from "../route"
import { auth } from "@/lib/auth"

describe("POST /api/pagos/adjuntos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("rejects expense attachments before touching storage", async () => {
    const form = new FormData()
    form.set("file", new File(["test"], "justificante.pdf", { type: "application/pdf" }))
    form.set("gastoId", "gasto-1")

    const request = { formData: async () => form } as unknown as NextRequest
    const response = await POST(request)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "EXPENSE_ATTACHMENTS_DISABLED" })
  })
})
