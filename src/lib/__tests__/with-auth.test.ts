import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse, type NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { withAuth } from "../with-auth"
import { auth } from "@/lib/auth"

const request = new Request("http://localhost/api/test") as unknown as NextRequest
const context = { params: Promise.resolve({ id: "record-1" }) }

describe("withAuth", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when there is no authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const handler = vi.fn()

    const response = await withAuth(handler as any)(request, context)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" })
    expect(handler).not.toHaveBeenCalled()
  })

  it("passes the session and route context to the handler", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
    const handler = vi.fn(async (_request, session, routeContext) => {
      const params = await routeContext.params
      return NextResponse.json({ userId: session.user.id, role: session.user.role, id: params.id })
    })

    const response = await withAuth(handler as any)(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: "user-1", role: "ADMIN", id: "record-1" })
  })
})
