import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Shift } from "@/types/shift"

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
  PSM: { SINGLE_BLOCK: 6, SINGLE_COLUMN: 4 },
}))

import CierreTurnoModal from "../cierre-turno-modal"

const shift: Shift = {
  id: "shift-1",
  date: "2026-08-27T00:00:00.000Z",
  turno: "mañana",
  status: "ABIERTO",
  efectivo: 100,
  caixa: 50,
  santander: 25,
  efectivoGasto: 0,
  fondoInicial: 100,
  fondoFinal: 100,
  expenses: [],
  createdAt: "2026-08-27T08:00:00.000Z",
}

describe("CierreTurnoModal", () => {
  it("allows closing without entering ticket information", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(true)
    vi.spyOn(window, "confirm").mockReturnValue(true)

    render(
      <CierreTurnoModal
        shift={shift}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        saving={false}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Cerrar turno sin información" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ sinInformacion: true }))
  })
})
