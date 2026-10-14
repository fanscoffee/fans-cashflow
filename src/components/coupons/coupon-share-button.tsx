"use client"

import { useState } from "react"
import type { PendingCoupon } from "@/types/order"

function couponMessage(coupon: PendingCoupon) {
  return `Hola ${coupon.clientName}, aquí tienes tu código de descuento del ${coupon.discountPercentage}% para Fans: ${coupon.code}. Válido durante 15 días.`
}

export default function CouponShareButton({
  coupon,
  onShared,
}: {
  coupon: PendingCoupon
  onShared: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState("")

  async function markShared() {
    setBusy(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/cupones/${coupon.id}/compartir`, { method: "POST" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo activar el cupón")
      onShared()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo activar el cupón")
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setBusy(true)
    setFeedback("")
    try {
      const text = couponMessage(coupon)
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Cupón Fans", text })
        await markShared()
        return
      }

      if (!navigator.clipboard) {
        setFeedback("Este dispositivo no permite compartir ni copiar el mensaje")
        return
      }

      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFeedback("Mensaje copiado. Pégalo en WhatsApp y confirma el envío.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setFeedback(error instanceof Error ? error.message : "No se pudo compartir el cupón")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={busy}
          className="min-h-10 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Procesando..." : "Compartir código"}
        </button>
        {copied && (
          <button
            type="button"
            onClick={() => void markShared()}
            disabled={busy}
            className="min-h-10 rounded-md border border-green-300 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            Marcar como compartido
          </button>
        )}
      </div>
      {feedback && <p className="text-xs text-gray-600">{feedback}</p>}
    </div>
  )
}
