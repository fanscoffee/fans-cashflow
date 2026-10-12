"use client"

import { useState } from "react"

interface CouponResult {
  valid: boolean
  status: string
  message: string
  coupon?: {
    code: string
    clientName: string
    discountPercentage: number
    expiresAt: string
  }
}

function resultStyle(result: CouponResult) {
  if (result.status === "VALID") return "border-green-200 bg-green-50 text-green-800"
  if (result.status === "USED" || result.status === "EXPIRED") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-red-200 bg-red-50 text-red-800"
}

export default function CouponVerifier() {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<CouponResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [redeeming, setRedeeming] = useState(false)

  async function checkCoupon() {
    setChecking(true)
    setResult(null)
    try {
      const response = await fetch("/api/cupones/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await response.json()) as CouponResult
      setResult(data)
    } catch {
      setResult({ valid: false, status: "ERROR", message: "No se pudo conectar con el servidor." })
    } finally {
      setChecking(false)
    }
  }

  async function redeemCoupon() {
    setRedeeming(true)
    try {
      const response = await fetch("/api/cupones/canjear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await response.json()) as CouponResult
      setResult(data)
    } catch {
      setResult({ valid: false, status: "ERROR", message: "No se pudo conectar con el servidor." })
    } finally {
      setRedeeming(false)
    }
  }

  const canRedeem = result?.valid && result.status === "VALID"

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Promociones</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Verificar cupón</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Introduce el código que trae el cliente. Comprueba que siga vigente y márcalo como usado al aplicarlo.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (code.trim() && !checking) void checkCoupon()
          }}
        >
          <label className="sr-only" htmlFor="coupon-code">Código de cupón</label>
          <input
            id="coupon-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setResult(null)
            }}
            placeholder="TARTA15-JUAN-ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 font-mono text-base tracking-wide text-gray-950 placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={!code.trim() || checking || redeeming}
            className="min-h-12 rounded-xl bg-gray-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "Comprobando..." : "Comprobar"}
          </button>
        </form>

        {result && (
          <div className={`mt-5 rounded-xl border p-4 ${resultStyle(result)}`} aria-live="polite">
            <p className="font-semibold">{result.message}</p>
            {result.coupon && (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs opacity-70">Cliente</span>
                  <span className="font-medium">{result.coupon.clientName}</span>
                </div>
                <div>
                  <span className="block text-xs opacity-70">Descuento</span>
                  <span className="font-medium">{result.coupon.discountPercentage}%</span>
                </div>
                <div>
                  <span className="block text-xs opacity-70">Caduca</span>
                  <span className="font-medium">
                    {new Date(result.coupon.expiresAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            )}
            {canRedeem && (
              <button
                type="button"
                onClick={() => void redeemCoupon()}
                disabled={redeeming}
                className="mt-4 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                {redeeming ? "Marcando..." : "Marcar como usado"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
