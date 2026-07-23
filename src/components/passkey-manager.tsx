"use client"

import { useState, useEffect } from "react"
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"

interface Passkey {
  id: string
  credentialId: string
  createdAt: string
}

export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [supportsPasskeys] = useState(() => {
    if (typeof window === "undefined") return false
    return browserSupportsWebAuthn()
  })

  async function fetchPasskeys() {
    try {
      const res = await fetch("/api/passkeys/list")
      if (res.ok) {
        const data = await res.json()
        setPasskeys(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchPasskeys()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleRegister() {
    setRegistering(true)
    setError(null)
    setSuccess(null)

    try {
      const optionsRes = await fetch("/api/passkeys/register")
      if (!optionsRes.ok) {
        setError("Error al obtener opciones de registro")
        return
      }

      const options = await optionsRes.json()

      const credential = await startRegistration(options)

      const verifyRes = await fetch("/api/passkeys/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, challenge: options.challenge }),
      })

      if (!verifyRes.ok) {
        setError("Error al registrar Face ID")
        return
      }

      setSuccess("Face ID registrado correctamente")
      fetchPasskeys()
    } catch {
      setError("Error al registrar Face ID")
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(passkeyId: string) {
    try {
      const res = await fetch(`/api/passkeys/${passkeyId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setPasskeys((prev) => prev.filter((pk) => pk.id !== passkeyId))
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Face ID / Biometría</h2>

      {!supportsPasskeys ? (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700">
          <p className="font-medium">Tu navegador no soporta Face ID</p>
          <p className="mt-1">Para registrar tu Face ID o huella digital, abrí esta app en <strong>Safari</strong> (iPhone) o <strong>Chrome</strong> (Android).</p>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          {success && (
            <div className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
          )}

          <p className="mb-4 text-sm text-gray-600">
            Registra tu Face ID o huella digital para iniciar sesión más rápido.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <>
              {passkeys.length > 0 && (
                <div className="mb-4 space-y-2">
                  {passkeys.map((pk) => (
                    <div key={pk.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Face ID registrado</p>
                        <p className="text-xs text-gray-500">
                          {new Date(pk.createdAt).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(pk.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {registering ? "Registrando..." : "Registrar Face ID"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
