import { formatCouponDate } from "@/lib/coupons"

export class WhatsAppSendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WhatsAppSendError"
  }
}

export function normalizeWhatsAppPhone(phone: string) {
  let digits = phone.trim().replace(/^tel:/i, "").replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)

  const defaultCountryCode = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "34").replace(/\D/g, "")
  if (digits.length === 9 && /^[6789]/.test(digits) && defaultCountryCode) {
    digits = `${defaultCountryCode}${digits}`
  }

  return digits
}

function responseErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message
    }
  }
  return `WhatsApp respondió con el estado ${status}`
}

export async function sendCouponWhatsAppMessage({
  clientName,
  clientPhone,
  code,
  expiresAt,
}: {
  clientName: string
  clientPhone: string
  code: string
  expiresAt: Date
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME

  if (!accessToken || !phoneNumberId || !templateName) {
    throw new WhatsAppSendError(
      "Falta configurar WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TEMPLATE_NAME"
    )
  }

  const recipient = normalizeWhatsAppPhone(clientPhone)
  if (!recipient) throw new WhatsAppSendError("El teléfono del cliente no es válido para WhatsApp")

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0"
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_ES" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: clientName },
              { type: "text", text: code },
              { type: "text", text: formatCouponDate(expiresAt) },
            ],
          },
        ],
      },
    }),
  })

  const responseText = await response.text()
  let payload: unknown
  try {
    payload = responseText ? JSON.parse(responseText) : null
  } catch {
    payload = null
  }

  if (!response.ok) throw new WhatsAppSendError(responseErrorMessage(payload, response.status))

  if (
    !payload ||
    typeof payload !== "object" ||
    !("messages" in payload) ||
    !Array.isArray(payload.messages) ||
    !payload.messages[0] ||
    typeof payload.messages[0] !== "object" ||
    !("id" in payload.messages[0])
  ) {
    throw new WhatsAppSendError("WhatsApp no confirmó el envío del mensaje")
  }

  return { messageId: String(payload.messages[0].id) }
}
