import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import TurnosPage from "../page"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}))

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="app-header">
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
}))

vi.mock("@/components/notification-bell", () => ({
  default: () => <div data-testid="notification-bell" />,
}))

import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"

const mockShifts = [
  {
    id: "s1",
    date: "2026-07-22T00:00:00.000Z",
    turno: "mañana",
    status: "CERRADO",
    efectivo: 100,
    caixa: 50,
    santander: 30,
    fondoInicial: 200,
    fondoFinal: 280,
    expenses: [{ id: "e1", proveedor: "Frutas", importe: 25 }],
    createdAt: "2026-07-22T08:00:00.000Z",
    createdBy: { name: "Juan", email: "juan@test.com" },
  },
  {
    id: "s2",
    date: "2026-07-22T00:00:00.000Z",
    turno: "tarde",
    status: "ABIERTO",
    efectivo: 80,
    caixa: 40,
    santander: 20,
    fondoInicial: 280,
    fondoFinal: 340,
    expenses: [],
    createdAt: "2026-07-22T15:00:00.000Z",
    createdBy: { name: "Ana", email: "ana@test.com" },
  },
]

describe("TurnosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "SOCIO" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    vi.mocked(usePathname).mockReturnValue("/socio/turnos")
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockShifts),
    } as any)
  })

  it("renders loading state initially", () => {
    render(<TurnosPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders shifts after loading", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Historial de Turnos").length).toBeGreaterThan(0)
    })
  })

  it("renders filter controls", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Desde")).toBeInTheDocument()
      expect(screen.getByText("Hasta")).toBeInTheDocument()
      expect(screen.getByText("Turno")).toBeInTheDocument()
      expect(screen.getByText("Estado")).toBeInTheDocument()
      expect(screen.getByText("Persona")).toBeInTheDocument()
    })
  })

  it("filters by turno", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 2 de 2 turnos")).toBeInTheDocument()
    })

    const todosSelects = screen.getAllByDisplayValue("Todos")
    fireEvent.change(todosSelects[0], {
      target: { value: "mañana" },
    })

    await waitFor(() => {
      expect(screen.getByText("Mostrando 1 de 1 turnos")).toBeInTheDocument()
    })
  })

  it("filters by status", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 2 de 2 turnos")).toBeInTheDocument()
    })

    const statusSelects = screen.getAllByDisplayValue("Todos")
    fireEvent.change(statusSelects[1], {
      target: { value: "ABIERTO" },
    })

    await waitFor(() => {
      expect(screen.getByText("Mostrando 1 de 1 turnos")).toBeInTheDocument()
    })
  })

  it("filters by persona", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 2 de 2 turnos")).toBeInTheDocument()
    })

    fireEvent.input(screen.getByPlaceholderText("Nombre o email..."), {
      target: { value: "Juan" },
    })

    await waitFor(() => {
      expect(screen.getByText("Mostrando 1 de 1 turnos")).toBeInTheDocument()
    })
  })

  it("resets filters when Limpiar is clicked", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 2 de 2 turnos")).toBeInTheDocument()
    })

    fireEvent.input(screen.getByPlaceholderText("Nombre o email..."), {
      target: { value: "xyz" },
    })

    await waitFor(() => {
      expect(screen.getByText("No hay turnos que coincidan con los filtros.")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Limpiar"))

    await waitFor(() => {
      expect(screen.getByText("Mostrando 2 de 2 turnos")).toBeInTheDocument()
    })
  })

  it("shows empty state when no shifts", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as any)

    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay turnos registrados.")).toBeInTheDocument()
    })
  })

  it("renders per-shift total badge with correct sum", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      expect(screen.getByText("180.00 €")).toBeInTheDocument()
      expect(screen.getByText("140.00 €")).toBeInTheDocument()
    })
  })

  it("per-shift total badge has green styling", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      const badges = screen.getAllByText(/\d+\.\d+ €/)
      const greenBadge = badges.find((el) =>
        el.className.includes("bg-green-100") && el.className.includes("text-green-800")
      )
      expect(greenBadge).toBeTruthy()
    })
  })

  it("per-shift total badge appears after the person name", async () => {
    render(<TurnosPage />)
    await waitFor(() => {
      const juanName = screen.getByText("— Juan")
      const badges = juanName.parentElement?.querySelectorAll("span")
      const badgeTexts = Array.from(badges || []).map((b) => b.textContent)
      const juanIndex = badgeTexts.findIndex((t) => t?.includes("Juan"))
      const totalIndex = badgeTexts.findIndex((t) => t?.includes("180.00"))
      expect(totalIndex).toBeGreaterThan(juanIndex)
    })
  })
})
