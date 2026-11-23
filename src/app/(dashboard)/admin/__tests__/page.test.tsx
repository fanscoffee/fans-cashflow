import { afterEach, describe, expect, it, vi, beforeEach } from "vitest"
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
  { id: "u1", name: "Juan", email: "juan@test.com", role: "EMPLEADO", accessRevoked: false },
  { id: "u2", name: "Ana", email: "ana@test.com", role: "SOCIO", accessRevoked: false },
]

describe("AdminPage", () => {
  afterEach(() => vi.restoreAllMocks())

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

  it("shows Eliminar for employee, partner and bakery accounts but not for admins", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(Response.json([
      ...mockUsers,
      { id: "admin-1", name: "Otra admin", email: "admin@test.com", role: "ADMIN", accessRevoked: false },
      { id: "staff-2", name: "Eva", email: "eva@test.com", role: "OBRADOR", accessRevoked: false },
    ]))
    render(<AdminPage />)
    expect(await screen.findAllByRole("button", { name: "Eliminar acceso de Juan" })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Eliminar acceso de Eva" })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Eliminar acceso de Ana" })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Eliminar acceso de Otra admin" })).not.toBeInTheDocument()
  })

  it("asks for confirmation and does not revoke access if cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<AdminPage />)
    const [button] = await screen.findAllByRole("button", { name: "Eliminar acceso de Juan" })
    fireEvent.click(button)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Juan (juan@test.com)"))
    expect(global.fetch).not.toHaveBeenCalledWith("/api/admin/users/u1", expect.objectContaining({ method: "DELETE" }))
    expect(button).toBeEnabled()
  })

  it("marks a revoked partner as Sin acceso and leaves their identity visible", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(global.fetch).mockImplementation(async (url, init) => {
      if (url === "/api/admin/users/u2" && init?.method === "DELETE") return Response.json({ ok: true })
      if (url === "/api/admin/users") return Response.json(mockUsers)
      return Response.json(null)
    })
    render(<AdminPage />)
    const [, button] = await screen.findAllByRole("button", { name: "Eliminar acceso de Ana" })
    fireEvent.click(button)

    expect(await screen.findByText("Acceso de Ana eliminado")).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/users/u2", { method: "DELETE" })
    expect(screen.getAllByText("Sin acceso")).toHaveLength(2)
    expect(screen.getAllByText("ana@test.com")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Eliminar acceso de Ana" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Reactivar a Ana" })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Cambiar contraseña" })).toHaveLength(2)
  })

  it("keeps the employee active in the list if the request fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    vi.mocked(global.fetch).mockImplementation(async (url, init) => {
      if (url === "/api/admin/users/u1" && init?.method === "DELETE") {
        return Response.json({ error: "No se pudo quitar el acceso" }, { status: 500 })
      }
      if (url === "/api/admin/users") return Response.json(mockUsers)
      return Response.json(null)
    })
    render(<AdminPage />)
    const [button] = await screen.findAllByRole("button", { name: "Eliminar acceso de Juan" })
    fireEvent.click(button)

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo quitar el acceso")
    expect(button).toBeEnabled()
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument()
  })

  it("asks for a new password before reactivating the same account", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url, init) => {
      if (url === "/api/admin/users/u1" && init?.method === "PATCH") return Response.json({ ok: true })
      return Response.json([{ ...mockUsers[0], accessRevoked: true }, mockUsers[1]])
    })
    render(<AdminPage />)
    const [reactivate] = await screen.findAllByRole("button", { name: "Reactivar a Juan" })
    expect(screen.queryByRole("button", { name: "Reactivar a Ana" })).not.toBeInTheDocument()
    fireEvent.click(reactivate)
    const [submit] = screen.getAllByRole("button", { name: "Confirmar reactivación" })
    fireEvent.click(submit)
    expect(screen.getByRole("alert")).toHaveTextContent("La contraseña debe tener al menos 6 caracteres")
    expect(global.fetch).not.toHaveBeenCalledWith("/api/admin/users/u1", expect.anything())

    const [password] = screen.getAllByLabelText("Nueva contraseña para Juan")
    fireEvent.input(password, { target: { value: "new-secret" } })
    fireEvent.click(submit)

    expect(await screen.findByRole("status")).toHaveTextContent("Cuenta de Juan reactivada")
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/users/u1", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "new-secret", reactivate: true }),
    })
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Eliminar acceso de Juan" })).toHaveLength(2)
    expect(screen.getAllByText("juan@test.com")).toHaveLength(2)
    expect(screen.queryByLabelText("Nueva contraseña para Juan")).not.toBeInTheDocument()
  })

  it("keeps a failed reactivation revoked and lets the admin cancel", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url, init) => {
      if (url === "/api/admin/users/u2" && init?.method === "PATCH") {
        return Response.json({ error: "No se pudo reactivar" }, { status: 500 })
      }
      return Response.json([{ ...mockUsers[1], accessRevoked: true }])
    })
    render(<AdminPage />)
    const [, reactivate] = await screen.findAllByRole("button", { name: "Reactivar a Ana" })
    fireEvent.click(reactivate)
    const [, password] = screen.getAllByLabelText("Nueva contraseña para Ana")
    fireEvent.input(password, { target: { value: "new-secret" } })
    const [, submit] = screen.getAllByRole("button", { name: "Confirmar reactivación" })
    fireEvent.click(submit)

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo reactivar")
    expect(screen.getAllByText("Sin acceso")).toHaveLength(2)
    const [, cancel] = screen.getAllByRole("button", { name: "Cancelar" })
    fireEvent.click(cancel)
    expect(screen.getAllByRole("button", { name: "Reactivar a Ana" })).toHaveLength(2)
    expect(screen.queryByLabelText("Nueva contraseña para Ana")).not.toBeInTheDocument()
  })

  it("toggles the form when the new employee control is clicked", async () => {
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

    const saveButtons = screen.getAllByText("Guardar")
    fireEvent.click(saveButtons[0])

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
