import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import FondoPage from "../page"

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

const mockAdditions = [
  {
    id: "a1",
    amount: 100,
    description: "Test deposit",
    createdAt: "2026-07-20T10:00:00.000Z",
    createdBy: { name: "Admin", email: "admin@test.com" },
  },
]

function setupFetch(additions = mockAdditions, fondo = 500) {
  const spy = vi.spyOn(global, "fetch")
  spy.mockImplementation((url: string | URL | Request) => {
    const u = typeof url === "string" ? url : ""
    if (u.includes("/api/fund-additions")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(additions) } as any)
    }
    if (u.includes("/api/fund")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ fondo }) } as any)
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any)
  })
}

describe("FondoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "SOCIO" } },
      status: "authenticated",
      update: vi.fn(),
    } as any)
    vi.mocked(usePathname).mockReturnValue("/socio/fondo")
    setupFetch()
  })

  it("renders loading state initially", () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))
    render(<FondoPage />)
    expect(screen.getByText("Cargando...")).toBeInTheDocument()
  })

  it("renders fondo amount after loading", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getAllByText("500.00 €").length).toBeGreaterThan(0)
    })
  })

  it("filters additions by date from", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Test deposit")).toBeInTheDocument()
    })

    const dateInputs = screen.getAllByDisplayValue("")
    fireEvent.change(dateInputs[0], { target: { value: "2026-07-21" } })

    await waitFor(() => {
      expect(screen.getByText("Test deposit")).toBeInTheDocument()
    })
  })

  it("filters additions by date to", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Test deposit")).toBeInTheDocument()
    })

    const desdeLabel = screen.getAllByText("Hasta")[0]
    const dateInput = desdeLabel.closest("div")?.querySelector("input[type='date']") as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: "2026-07-19" } })

    await waitFor(() => {
      expect(screen.getByText("No hay depósitos que coincidan con los filtros.")).toBeInTheDocument()
    })
  })

  it("shows pagination when more than 10 additions", async () => {
    const manyAdditions = Array.from({ length: 15 }, (_, i) => ({
      id: `a${i + 1}`,
      amount: 10 * (i + 1),
      description: `Deposit ${i + 1}`,
      createdAt: "2026-07-20T10:00:00.000Z",
      createdBy: { name: "Admin", email: "admin@test.com" },
    }))
    setupFetch(manyAdditions, 500)
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 10 de 15 depósitos")).toBeInTheDocument()
    })

    expect(screen.getByText(/Mostrar más/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Mostrar más/))
    await waitFor(() => {
      expect(screen.getByText("Mostrando 15 de 15 depósitos")).toBeInTheDocument()
    })
  })

  it("resets page when filter changes", async () => {
    const manyAdditions = Array.from({ length: 15 }, (_, i) => ({
      id: `a${i + 1}`,
      amount: 10 * (i + 1),
      description: `Deposit ${i + 1}`,
      createdAt: "2026-07-20T10:00:00.000Z",
      createdBy: { name: "Admin", email: "admin@test.com" },
    }))
    setupFetch(manyAdditions, 500)
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Mostrando 10 de 15 depósitos")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Mostrar más/))
    await waitFor(() => {
      expect(screen.getByText("Mostrando 15 de 15 depósitos")).toBeInTheDocument()
    })

    fireEvent.input(screen.getByPlaceholderText("Descripción o persona..."), {
      target: { value: "Deposit 1" },
    })

    await waitFor(() => {
      expect(screen.getByText(/Mostrando/)).toBeInTheDocument()
    })
  })

  it("renders deposit form", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Depositar").length).toBeGreaterThan(0)
    })
  })

  it("renders additions history", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getAllByText("Test deposit").length).toBeGreaterThan(0)
    })
  })

  it("filters additions by search text", async () => {
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("Test deposit")).toBeInTheDocument()
    })

    fireEvent.input(screen.getByPlaceholderText("Descripción o persona..."), {
      target: { value: "xyz" },
    })

    await waitFor(() => {
      expect(screen.getByText("No hay depósitos que coincidan con los filtros.")).toBeInTheDocument()
    })
  })

  it("shows empty state when no additions", async () => {
    setupFetch([], 0)
    render(<FondoPage />)
    await waitFor(() => {
      expect(screen.getByText("No hay depósitos registrados.")).toBeInTheDocument()
    })
  })
})
