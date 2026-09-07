import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Providers from "@/app/providers"
import { ShiftCard } from "../shift-card"

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
}))

const shift = {
  id: "shift-1",
  date: "2026-09-07",
  shift: "mañana",
  status: "ABIERTO",
  cash: 0,
  caixaBankAmount: 0,
  santanderAmount: 0,
  cashExpense: 0,
  openingFund: 100,
  closingFund: 100,
  expenses: [],
  currentExpenses: [],
  createdAt: "2026-09-07T00:00:00.000Z",
}

describe("ShiftCard current expenses", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends the complete concept typed by the employee", async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ categories: [{ id: "cat-men", code: "MEN", name: "Compras menores" }], creditors: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "expense-1" }), { status: 201 }))

    render(
      <Providers>
        <ShiftCard
          shift={shift}
          userRole="EMPLEADO"
          onSave={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn().mockResolvedValue(true)}
          onReopen={vi.fn().mockResolvedValue(undefined)}
          closingShift={null}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    )

    await user.click(screen.getAllByRole("button", { name: "+ Gasto corriente" })[0])
    const concept = await screen.findByLabelText("Concepto")
    await user.type(concept, "CREMOSITO")
    await user.type(screen.getByLabelText("Importe"), "20")

    expect(concept).toHaveValue("CREMOSITO")
    await user.click(screen.getByRole("button", { name: "Guardar gasto" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({ concept: "CREMOSITO", amount: 20 })
  })
})
