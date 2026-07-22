import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import LoginPage from "../page"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}))

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    return <img src={src as string} alt={alt as string} {...rest} />
  },
}))

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => false),
}))

vi.mock("@/lib/roles", () => ({
  ROLE_REDIRECT: { ADMIN: "/admin", SOCIO: "/socio", EMPLEADO: "/empleado" },
}))

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser"

describe("LoginPage", () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { role: "SOCIO" } }),
    } as any)
  })

  it("renders login form", () => {
    render(<LoginPage />)
    expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
    expect(screen.getByText("Inicia sesión en tu cuenta")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("tu@email.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("••••••")).toBeInTheDocument()
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument()
  })

  it("shows validation errors for empty form", async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(screen.getByText("Email no válido")).toBeInTheDocument()
    })
  })

  it("shows validation error for short password", async () => {
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(screen.getByText("La contraseña debe tener al menos 6 caracteres")).toBeInTheDocument()
    })
  })

  it("calls signIn on valid form submit", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null } as any)
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123456" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@test.com",
        password: "123456",
        redirect: false,
      })
    })
  })

  it("shows error on failed login", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "CredentialsSignin" } as any)
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123456" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(screen.getByText("Email o contraseña incorrectos")).toBeInTheDocument()
    })
  })

  it("redirects on successful login", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: null } as any)
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123456" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/socio")
    })
  })

  it("shows error on network failure", async () => {
    vi.mocked(signIn).mockRejectedValue(new Error("Network error"))
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123456" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(screen.getByText("Error al iniciar sesión")).toBeInTheDocument()
    })
  })

  it("shows passkey button when supported", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })
  })

  it("handles passkey login flow", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(startAuthentication).mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} } as any)

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ challenge: "ch123", rp: { id: "test" }, user: { id: "u1" }, pubKeyCredParams: [] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: "u1", role: "SOCIO" } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as any)

    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Face ID.*Biometría/))

    await waitFor(() => {
      expect(startAuthentication).toHaveBeenCalled()
    })
  })

  it("shows passkey error when authenticate options fail", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "No hay passkeys" }),
    } as any)

    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Face ID.*Biometría/))

    await waitFor(() => {
      expect(screen.getByText("No hay passkeys")).toBeInTheDocument()
    })
  })

  it("shows passkey error when verify fails", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(startAuthentication).mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} } as any)

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ challenge: "ch123", rp: { id: "test" }, user: { id: "u1" }, pubKeyCredParams: [] }),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Autenticación fallida" }),
      } as any)

    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Face ID.*Biometría/))

    await waitFor(() => {
      expect(screen.getByText("Autenticación fallida")).toBeInTheDocument()
    })
  })

  it("shows passkey error when passkey-signin fails", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(startAuthentication).mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} } as any)

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ challenge: "ch123", rp: { id: "test" }, user: { id: "u1" }, pubKeyCredParams: [] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: "u1", role: "SOCIO" } }),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Error al iniciar sesión" }),
      } as any)

    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Face ID.*Biometría/))

    await waitFor(() => {
      expect(screen.getByText("Error al iniciar sesión")).toBeInTheDocument()
    })
  })

  it("shows passkey error when startAuthentication throws", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(startAuthentication).mockRejectedValue(new Error("cancelled"))

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ challenge: "ch123", rp: { id: "test" }, user: { id: "u1" }, pubKeyCredParams: [] }),
    } as any)

    render(<LoginPage />)
    await waitFor(() => {
      expect(screen.getByText(/Face ID.*Biometría/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Face ID.*Biometría/))

    await waitFor(() => {
      expect(screen.getByText("Error con Face ID / biometría")).toBeInTheDocument()
    })
  })

  it("hides passkey button when not supported", () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false)
    render(<LoginPage />)
    expect(screen.queryByText(/Face ID.*Biometría/)).not.toBeInTheDocument()
  })

  it("shows loading state during submit", async () => {
    vi.mocked(signIn).mockImplementation(() => new Promise(() => {}))
    render(<LoginPage />)
    fireEvent.input(screen.getByPlaceholderText("tu@email.com"), { target: { value: "test@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("••••••"), { target: { value: "123456" } })
    fireEvent.click(screen.getByText("Iniciar sesión"))
    await waitFor(() => {
      expect(screen.getByText("Entrando...")).toBeInTheDocument()
    })
  })
})
