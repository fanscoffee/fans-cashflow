import { afterEach, describe, expect, it, vi } from "vitest"
import { normalizeWhatsAppPhone, sendCouponWhatsAppMessage } from "@/lib/whatsapp"

describe("WhatsApp coupon sender", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("normalizes a Spanish local phone number", () => {
    expect(normalizeWhatsAppPhone("600 123 456")).toBe("34600123456")
    expect(normalizeWhatsAppPhone("+34 600 123 456")).toBe("34600123456")
  })

  it("sends the approved template with coupon parameters", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token")
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id")
    vi.stubEnv("WHATSAPP_TEMPLATE_NAME", "promo_tarta")
    vi.stubEnv("WHATSAPP_TEMPLATE_LANGUAGE", "es_ES")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }))
    )

    await expect(
      sendCouponWhatsAppMessage({
        clientName: "Juan",
        clientPhone: "600123456",
        code: "TARTA15-JUAN-ABC123",
        expiresAt: new Date("2026-10-26T10:00:00.000Z"),
      })
    ).resolves.toEqual({ messageId: "wamid.1" })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(String(options?.body))
    expect(body.to).toBe("34600123456")
    expect(body.template.name).toBe("promo_tarta")
    expect(body.template.components[0].parameters).toHaveLength(3)
  })
})
