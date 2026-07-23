"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"
import { ROLE_REDIRECT } from "@/lib/roles"

const loginSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [supportsPasskeys, setSupportsPasskeys] = useState(false)
  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn())
  }, [])
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setError(null)
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError("Email o contraseña incorrectos")
        return
      }

      const res = await fetch("/api/auth/session")
      const session = await res.json()
      const role = session?.user?.role

      router.push(ROLE_REDIRECT[role] ?? "/empleado")
    } catch {
      setError("Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true)
    setPasskeyError(null)

    try {
      const emailInput = document.getElementById("email") as HTMLInputElement
      const email = emailInput?.value

      const optionsRes = await fetch("/api/passkeys/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
      })

      if (!optionsRes.ok) {
        const err = await optionsRes.json()
        setPasskeyError(err.error || "No hay passkeys disponibles")
        return
      }

      const options = await optionsRes.json()

      const credential = await startAuthentication(options)

      const verifyRes = await fetch("/api/passkeys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, challenge: options.challenge }),
      })

      if (!verifyRes.ok) {
        setPasskeyError("Autenticación fallida")
        return
      }

      const { user } = await verifyRes.json()

      const signinRes = await fetch("/api/auth/passkey-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!signinRes.ok) {
        setPasskeyError("Error al iniciar sesión")
        return
      }

      window.location.href = ROLE_REDIRECT[user.role] ?? "/empleado"
    } catch {
      setPasskeyError("Error con Face ID / biometría")
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <Image src="/fans-logo-oscuro.png" alt="Fans" width={96} height={96} className="mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-gray-900">Fans Cashflow</h1>
        <p className="mt-1 text-sm text-gray-500">Inicia sesión en tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="tu@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            {...register("password")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>
      </form>

      {supportsPasskeys && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {passkeyError && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {passkeyError}
            </div>
          )}

          <button
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {passkeyLoading ? (
              "Verificando..."
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Usar Face ID / Biometría
              </span>
            )}
          </button>
        </>
      )}
    </div>
  )
}
