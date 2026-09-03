import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Shift } from "@/types/shift"

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
  PSM: { SINGLE_BLOCK: 6, SINGLE_COLUMN: 4 },
}))

import ShiftCloseModal from "../shift-close-modal"

const shift: Shift = {
  id: "shift-1",
  date: "2026-08-27T00:00:00.000Z",
  shift: "mañana",
  status: "ABIERTO",
  cash: 100,
  caixaBankAmount: 50,
  santanderAmount: 25,
  cashExpense: 0,
  openingFund: 100,
  closingFund: 100,
  expenses: [],
  createdAt: "2026-08-27T08:00:00.000Z",
}

describe("ShiftCloseModal", () => {
  it("allows closing without entering ticket information", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(true)
    vi.spyOn(window, "confirm").mockReturnValue(true)

    render(
      <ShiftCloseModal
        shift={shift}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        saving={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Cerrar turno sin información" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ noInformation: true }))
  })
})
