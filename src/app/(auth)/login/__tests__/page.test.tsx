import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const server = setupServer(
  http.post("/api/auth/passkey-signin", () => HttpResponse.json({ user: { id: "1", role: "EMPLEADO" } })),
  http.post("/api/passkeys/authenticate", () => HttpResponse.json({ challenge: "abc" })),
  http.post("/api/passkeys/verify", () => HttpResponse.json({ user: { id: "1", role: "EMPLEADO" } })),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockSignIn = vi.fn().mockResolvedValue({ error: null })
const mockPush = vi.fn()

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn().mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} }),
}))

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

import LoginPage from "../page"

describe("LoginPage", () => {
  beforeEach(() => {
    mockSignIn.mockClear()
    mockPush.mockClear()
  })

  it("renders login form", () => {
    render(<LoginPage />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getByText("Inicia sesión en tu cuenta")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument()
  })

  it("renders submit button", () => {
    render(<LoginPage />)
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))
    await waitFor(() => {
      expect(screen.getByText("Email no válido")).toBeInTheDocument()
      expect(screen.getByText("La contraseña debe tener al menos 6 caracteres")).toBeInTheDocument()
    })
  })

  it("shows passkey button when WebAuthn supported", () => {
    render(<LoginPage />)
    expect(screen.getByText(/Face ID/i)).toBeInTheDocument()
  })

  it("calls signIn with credentials", async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: null })

    vi.spyOn(global, "fetch").mockImplementation(async (url: string | Request | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString()
      if (urlStr.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ user: { role: "EMPLEADO" } }), { status: 200 })
      }
      return new Response("{}", { status: 200 })
    })

    render(<LoginPage />)
    await user.type(screen.getByLabelText("Email"), "test@test.com")
    await user.type(screen.getByLabelText("Contraseña"), "password123")
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@test.com",
      password: "password123",
      redirect: false,
    })

    vi.restoreAllMocks()
  })

  it("shows error on failed login", async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" })

    render(<LoginPage />)
    await user.type(screen.getByLabelText("Email"), "test@test.com")
    await user.type(screen.getByLabelText("Contraseña"), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(screen.getByText("Email o contraseña incorrectos")).toBeInTheDocument()
    })
  })

  it("shows loading state during login", async () => {
    const user = userEvent.setup()
    let resolveSignIn: (v: { error: null }) => void
    mockSignIn.mockImplementation(() => new Promise((r) => { resolveSignIn = r }))

    render(<LoginPage />)
    await user.type(screen.getByLabelText("Email"), "test@test.com")
    await user.type(screen.getByLabelText("Contraseña"), "password123")
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }))

    expect(screen.getByText("Entrando...")).toBeInTheDocument()

    resolveSignIn!({ error: null })
    await waitFor(() => {
      expect(screen.queryByText("Entrando...")).not.toBeInTheDocument()
    })
  })
})
