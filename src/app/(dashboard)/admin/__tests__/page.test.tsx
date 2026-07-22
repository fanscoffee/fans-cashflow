import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AdminPage from "../page"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    return <img src={src as string} alt={alt as string} {...rest} />
  },
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

vi.mock("@/components/notification-bell", () => ({
  default: () => <div data-testid="notification-bell" />,
}))

import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"

const mockUsers = [
  { id: "u1", name: "Juan", email: "juan@test.com", role: "EMPLEADO" },
  { id: "u2", name: "Ana", email: "ana@test.com", role: "SOCIO" },
]

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "ADMIN", name: "Admin" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    vi.mocked(usePathname).mockReturnValue("/admin")
    vi.spyOn(global, "fetch").mockImplementation((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : ""
      if (u.includes("/api/admin/users") && u.includes("PATCH")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any)
      }
      if (u.includes("/api/admin/users")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) } as any)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any)
    })
  })

  it("renders loading state initially", () => {
    vi.mocked(global.fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<AdminPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders user list after loading", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Ana").length).toBeGreaterThan(0)
    })
  })

  it("shows role badges", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Empleado").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Socio").length).toBeGreaterThan(0)
    })
  })

  it("toggles form when +Nuevo empleado is clicked", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText("+ Nuevo empleado"))
    expect(screen.getByPlaceholderText("Nombre del empleado")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("email@ejemplo.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Mínimo 6 caracteres")).toBeInTheDocument()
  })

  it("creates user on form submit", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "u3", name: "Pedro" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([...mockUsers, { id: "u3", name: "Pedro" }]),
      } as any)

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText("+ Nuevo empleado"))

    fireEvent.input(screen.getByPlaceholderText("Nombre del empleado"), { target: { value: "Pedro" } })
    fireEvent.input(screen.getByPlaceholderText("email@ejemplo.com"), { target: { value: "pedro@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("Mínimo 6 caracteres"), { target: { value: "123456" } })

    fireEvent.click(screen.getByText("Crear empleado"))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({ method: "POST" })
      )
    })
  })

  it("shows error when user creation fails", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Email ya existe" }),
      } as any)

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText("+ Nuevo empleado"))

    fireEvent.input(screen.getByPlaceholderText("Nombre del empleado"), { target: { value: "Dup" } })
    fireEvent.input(screen.getByPlaceholderText("email@ejemplo.com"), { target: { value: "juan@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("Mínimo 6 caracteres"), { target: { value: "123456" } })

    fireEvent.click(screen.getByText("Crear empleado"))

    await waitFor(() => {
      expect(screen.getByText("Email ya existe")).toBeInTheDocument()
    })
  })

  it("opens password editor for a user", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByText("Cambiar contraseña")
    fireEvent.click(editButtons[0])

    expect(screen.getAllByPlaceholderText("Nueva contraseña").length).toBeGreaterThan(0)
  })

  it("cancels password edit", async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByText("Cambiar contraseña")
    fireEvent.click(editButtons[0])

    const cancelButtons = screen.getAllByText("Cancelar")
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    expect(screen.getAllByText("Cambiar contraseña").length).toBeGreaterThanOrEqual(2)
  })

  it("saves password successfully", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Contraseña actualizada" }),
      } as any)

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByText("Cambiar contraseña")
    fireEvent.click(editButtons[0])

    const pwInputs = screen.getAllByPlaceholderText("Nueva contraseña")
    fireEvent.input(pwInputs[0], { target: { value: "newpass123" } })

    const guardarButtons = screen.getAllByText("Guardar")
    fireEvent.click(guardarButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText("Cambiar contraseña").length).toBeGreaterThanOrEqual(2)
    })
  })

  it("shows empty state when no users", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as any)

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay usuarios registrados.")).toBeInTheDocument()
    })
  })

  it("shows success after user creation", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "u3", name: "Pedro" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([...mockUsers, { id: "u3", name: "Pedro" }]),
      } as any)

    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Juan").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText("+ Nuevo empleado"))

    fireEvent.input(screen.getByPlaceholderText("Nombre del empleado"), { target: { value: "Pedro" } })
    fireEvent.input(screen.getByPlaceholderText("email@ejemplo.com"), { target: { value: "pedro@test.com" } })
    fireEvent.input(screen.getByPlaceholderText("Mínimo 6 caracteres"), { target: { value: "123456" } })

    fireEvent.click(screen.getByText("Crear empleado"))

    await waitFor(() => {
      expect(screen.getByText("Usuario Pedro creado correctamente")).toBeInTheDocument()
    })
  })
})
