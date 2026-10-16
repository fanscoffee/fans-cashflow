import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ShiftTicketsPanel from "../shift-tickets-panel"

vi.mock("@/lib/csv", () => ({
  downloadCSV: vi.fn(),
}))

import { downloadCSV } from "@/lib/csv"

const tickets = [{
  id: "shift-1",
  date: "2026-07-22",
  ticketNumber: "1695",
  cash: 420,
  card: 758.45,
  vat4Base: 28.08,
  vat4: 1.12,
  vat10Base: 1044.8,
  vat10: 104.45,
}]

describe("ShiftTicketsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tickets }),
    } as any)
  })

  it("loads selected month and renders every requested column", async () => {
    render(<ShiftTicketsPanel />)

    await waitFor(() => expect(screen.getByText("1695")).toBeInTheDocument())
    expect(screen.getByText("22/7/2026")).toBeInTheDocument()
    expect(screen.getByText("420,00 €")).toBeInTheDocument()
    expect(screen.getByText("758,45 €")).toBeInTheDocument()
    expect(screen.getByText("Base IVA 4%")).toBeInTheDocument()
    expect(screen.getByText("IVA 4%")).toBeInTheDocument()
    expect(screen.getByText("Base IVA 10%")).toBeInTheDocument()
    expect(screen.getByText("IVA 10%")).toBeInTheDocument()
  })

  it("reloads when month changes", async () => {
    render(<ShiftTicketsPanel />)
    await waitFor(() => expect(screen.getByText("1695")).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText("Mes de consulta"), { target: { value: "2026-07" } })

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith("/api/gestoria/tickets?month=7&year=2026"))
  })

  it("exports current month rows as CSV", async () => {
    render(<ShiftTicketsPanel />)
    await waitFor(() => expect(screen.getByText("1695")).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText("Mes de consulta"), { target: { value: "2026-07" } })
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith("/api/gestoria/tickets?month=7&year=2026"))
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }))

    expect(downloadCSV).toHaveBeenCalledWith([
      {
        Ticket: "1695",
        Fecha: "22/7/2026",
        Efectivo: "420.00",
        Tarjeta: "758.45",
        "Base IVA 4%": "28.08",
        "IVA 4%": "1.12",
        "Base IVA 10%": "1044.80",
        "IVA 10%": "104.45",
      },
    ], "fans-cashflow-turnos-2026-07.csv")
  })
})
