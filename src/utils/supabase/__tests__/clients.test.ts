import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { createBrowserClient, createServerClient } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key"
  return {
    createBrowserClient: vi.fn(),
    createServerClient: vi.fn(),
  }
})

vi.mock("@supabase/ssr", () => ({ createBrowserClient, createServerClient }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

import { createClient as createBrowser } from "../client"
import { createClient as createServer } from "../server"
import { createClient as createMiddleware } from "../middleware"

describe("Supabase client adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createBrowserClient).mockReturnValue({ kind: "browser" } as any)
    vi.mocked(createServerClient).mockReturnValue({ kind: "server" } as any)
  })

  it("creates the browser client with the public environment variables", () => {
    expect(createBrowser()).toEqual({ kind: "browser" })
    expect(createBrowserClient).toHaveBeenCalledWith("https://example.supabase.co", "publishable-key")
  })

  it("adapts server cookies and ignores writes from server components", () => {
    const cookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: "session", value: "token" }]),
      set: vi.fn(),
    }

    expect(createServer(cookieStore as any)).toEqual({ kind: "server" })
    const options = vi.mocked(createServerClient).mock.calls[0]?.[2] as any
    expect(options.cookies.getAll()).toEqual([{ name: "session", value: "token" }])
    options.cookies.setAll([{ name: "session", value: "new-token", options: { path: "/" } }])
    expect(cookieStore.set).toHaveBeenCalledWith("session", "new-token", { path: "/" })

    const readOnlyCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(() => { throw new Error("read only") }),
    }
    createServer(readOnlyCookieStore as any)
    const readOnlyOptions = vi.mocked(createServerClient).mock.calls[1]?.[2] as any
    expect(() => readOnlyOptions.cookies.setAll([{ name: "session", value: "token", options: {} }])).not.toThrow()
  })

  it("refreshes middleware cookies on the request and response", () => {
    const request = new NextRequest("http://localhost/login")

    expect(createMiddleware(request)).toEqual({ kind: "server" })
    const options = vi.mocked(createServerClient).mock.calls[0]?.[2] as any
    expect(options.cookies.getAll()).toEqual([])
    options.cookies.setAll([{ name: "session", value: "token", options: { path: "/" } }])
    expect(request.cookies.get("session")?.value).toBe("token")
  })
})
