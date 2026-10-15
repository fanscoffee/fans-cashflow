"use client";

import { useState } from "react";
import type { PendingCoupon } from "@/types/order";

function formatClientName(name: string) {
  const trimmedName = name.trim();
  if (trimmedName !== trimmedName.toLocaleUpperCase("es-ES"))
    return trimmedName;

  return trimmedName
    .toLocaleLowerCase("es-ES")
    .split(/\s+/)
    .map((part) => part.charAt(0).toLocaleUpperCase("es-ES") + part.slice(1))
    .join(" ");
}

function couponMessage(coupon: PendingCoupon) {
  return `¡Hola, ${formatClientName(coupon.clientName)}! ☕🍰

Espero que hayas disfrutado mucho de la tarta. Cuéntame, ¿qué tal estuvo todo?

Queremos premiar que eres parte de nuestra comunidad Fans Coffee, te regalamos un ${coupon.discountPercentage}% de descuento en tu próxima compra, válido durante los próximos 15 días.

🎟️ Tu código: ${coupon.code}

¡Muchas gracias por confiar en nosotros para endulzarte el día! Esperamos verte muy pronto por aquí. ✨`;
}

function whatsappUrl(coupon: PendingCoupon) {
  const digits = coupon.clientPhone.replace(/\D/g, "");
  const phone = digits.startsWith("00")
    ? digits.slice(2)
    : digits.length === 9
      ? `34${digits}`
      : digits;

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(couponMessage(coupon))}`;
}

type Feedback = {
  message: string;
  tone: "success" | "error";
};

export default function CouponShareButton({
  coupon,
  onShared,
}: {
  coupon: PendingCoupon;
  onShared: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [canConfirm, setCanConfirm] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function markShared() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/cupones/${coupon.id}/compartir`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo activar el cupón");
      onShared();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No se pudo activar el cupón",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    setFeedback(null);
    try {
      const text = couponMessage(coupon);
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        await markShared();
        return;
      }

      if (!navigator.clipboard) {
        setFeedback({
          message: "Este dispositivo no permite compartir ni copiar el mensaje",
          tone: "error",
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      setCanConfirm(true);
      setFeedback({
        message:
          "Mensaje copiado. Pégalo en WhatsApp o pulsa «Abrir WhatsApp»; después marca el cupón como compartido.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No se pudo compartir el cupón",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleWhatsAppOpen() {
    void markShared();
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
        <a
          href={whatsappUrl(coupon)}
          target="_blank"
          rel="noreferrer"
          onClick={handleWhatsAppOpen}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-green-300 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50"
        >
          Abrir WhatsApp
        </a>
        {canConfirm && (
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
      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-xs font-medium ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
