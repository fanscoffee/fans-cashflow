import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const mockUsers = [
  { id: "u1", name: "Admin", email: "admin@test.com", role: "ADMIN" },
  { id: "u2", name: "Empleado 1", email: "emp@test.com", role: "EMPLEADO" },
  { id: "u3", name: "Socio 1", email: "socio@test.com", role: "SOCIO" },
]

const server = setupServer(
  http.get("/api/admin/users", () => HttpResponse.json(mockUsers)),
  http.post("/api/admin/users", async ({ request }) => {
    const body = await request.json() as { name: string; email: string; role: string }
    return HttpResponse.json({ id: "u-new", ...body }, { status: 201 })
  }),
  http.patch("/api/admin/users/:id", () => HttpResponse.json({ ok: true })),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
    status: "authenticated",
  }),
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}))

import AdminPage from "../page"

describe("AdminPage", () => {
  it("renders page title and subtitle", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("Fans Cashflow")).toBeInTheDocument()
      expect(screen.getByText("Empleados")).toBeInTheDocument()
    })
  })

  it("shows loading state initially", () => {
    render(<AdminPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders user list after loading", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Empleado 1").length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText("Socio 1").length).toBeGreaterThanOrEqual(1)
  })

  it("shows section title", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("Empleados")).toBeInTheDocument()
    })
  })

  it("shows new employee button", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("+ Nuevo empleado")).toBeInTheDocument()
    })
  })

  it("shows empty state when no users", async () => {
    server.use(http.get("/api/admin/users", () => HttpResponse.json([])))
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay usuarios registrados.")).toBeInTheDocument()
    })
  })

  it("toggles form on new employee button click", async () => {
    const user = userEvent.setup()
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("+ Nuevo empleado")).toBeInTheDocument()
    })

    await user.click(screen.getByText("+ Nuevo empleado"))
    expect(screen.getByText("Crear empleado")).toBeInTheDocument()

    await user.click(screen.getByText("Cancelar"))
    expect(screen.queryByText("Crear empleado")).not.toBeInTheDocument()
  })

  it("shows change password button for each user", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Empleado 1").length).toBeGreaterThanOrEqual(1)
    })
    const pwdButtons = screen.getAllByText("Cambiar contraseña")
    expect(pwdButtons.length).toBeGreaterThanOrEqual(3)
  })

  it("opens password form on user click", async () => {
    const user = userEvent.setup()
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Empleado 1").length).toBeGreaterThanOrEqual(1)
    })
    const pwdButtons = screen.getAllByText("Cambiar contraseña")
    await user.click(pwdButtons[0])
    expect(screen.getAllByPlaceholderText("Nueva contraseña").length).toBeGreaterThanOrEqual(1)
  })
})
