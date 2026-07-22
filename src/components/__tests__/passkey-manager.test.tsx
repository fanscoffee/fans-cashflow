import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import PasskeyManager from "../passkey-manager"

const mockPasskeys = [
  { id: "pk-1", credentialId: "cred-1", createdAt: "2026-07-22T10:00:00.000Z" },
]

let registerGetCalled = false
let registerPostOk = true

const server = setupServer(
  http.get("/api/passkeys/list", () => HttpResponse.json(mockPasskeys)),
  http.get("/api/passkeys/register", () => {
    registerGetCalled = true
    if (!registerPostOk) return HttpResponse.json({ error: "Error" }, { status: 500 })
    return HttpResponse.json({ challenge: "ch123", rp: { id: "test" }, user: { id: "u1", name: "test" }, pubKeyCredParams: [] })
  }),
  http.post("/api/passkeys/register", async () => {
    if (!registerPostOk) return HttpResponse.json({ error: "Error al registrar" }, { status: 500 })
    return HttpResponse.json({ ok: true })
  }),
  http.delete("/api/passkeys/:id", () => HttpResponse.json({ ok: true })),
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  registerGetCalled = false
  registerPostOk = true
})
afterAll(() => server.close())

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn().mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} }),
}))

describe("PasskeyManager", () => {
  it("shows loading state initially", async () => {
    let resolveFetch: (v: Response) => void
    const fetchPromise = new Promise<Response>((r) => { resolveFetch = r })
    vi.spyOn(global, "fetch").mockReturnValue(fetchPromise)

    render(<PasskeyManager />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()

    resolveFetch!(new Response(JSON.stringify([]), { status: 200 }))
    await waitFor(() => {
      expect(screen.queryByText("Cargando...")).not.toBeInTheDocument()
    })

    vi.restoreAllMocks()
  })

  it("renders passkeys after loading", async () => {
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })
  })

  it("shows register button", async () => {
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /registrar face id/i })).toBeInTheDocument()
  })

  it("shows delete button for each passkey", async () => {
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })
    expect(screen.getByText("Eliminar")).toBeInTheDocument()
  })

  it("deletes passkey on confirm", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Eliminar"))
    await waitFor(() => {
      expect(screen.queryByText("Face ID registrado")).not.toBeInTheDocument()
    })
  })

  it("registers passkey successfully", async () => {
    const user = userEvent.setup()
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /registrar face id/i }))

    await waitFor(() => {
      expect(screen.getByText("Face ID registrado correctamente")).toBeInTheDocument()
    })
  })

  it("shows error when register options fetch fails", async () => {
    registerPostOk = false
    const user = userEvent.setup()
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /registrar face id/i }))

    await waitFor(() => {
      expect(screen.getByText("Error al obtener opciones de registro")).toBeInTheDocument()
    })
  })

  it("shows error when startRegistration throws", async () => {
    const { startRegistration } = await import("@simplewebauthn/browser")
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error("User cancelled"))
    const user = userEvent.setup()
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByText("Face ID registrado")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /registrar face id/i }))

    await waitFor(() => {
      expect(screen.getByText("Error al registrar Face ID")).toBeInTheDocument()
    })

    vi.mocked(startRegistration).mockResolvedValue({ id: "cred-1", rawId: "raw", response: {} } as any)
  })

  it("shows empty state when no passkeys", async () => {
    server.use(http.get("/api/passkeys/list", () => HttpResponse.json([])))
    render(<PasskeyManager />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /registrar face id/i })).toBeInTheDocument()
    })
    expect(screen.queryByText("Face ID registrado")).not.toBeInTheDocument()
  })
})
