import { beforeEach, describe, expect, it, vi } from "vitest"

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock("@supabase/supabase-js", () => ({ createClient }))

import { getPaymentStorage, paymentStorageBucket } from "../payments-storage"

describe("payments-storage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it("returns no storage client when the service credentials are incomplete", () => {
    expect(getPaymentStorage()).toBeNull()

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    expect(getPaymentStorage()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("creates a non-persistent service client when credentials exist", () => {
    const client = { storage: {} }
    vi.mocked(createClient).mockReturnValue(client)
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    expect(getPaymentStorage()).toBe(client)
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-role-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    expect(paymentStorageBucket).toBe("payment-documents")
  })
})
