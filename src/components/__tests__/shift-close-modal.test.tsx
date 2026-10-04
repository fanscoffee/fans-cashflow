import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Shift } from "@/types/shift"

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
  PSM: { SINGLE_BLOCK: 6, SINGLE_COLUMN: 4, SPARSE_TEXT: 11 },
}))

import ShiftCloseModal from "../shift-close-modal"
import { createWorker } from "tesseract.js"

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
  it("removes TPV and cash drawer fields while keeping the other sections", () => {
    render(
      <ShiftCloseModal
        shift={shift}
        requirePhoto={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        saving={false}
      />,
    )

    expect(screen.queryByText("TPV")).not.toBeInTheDocument()
    expect(screen.queryByText("Cajón de efectivo")).not.toBeInTheDocument()
    expect(screen.getByText("Resumen de ventas")).toBeInTheDocument()
    expect(screen.getByText("Impuestos")).toBeInTheDocument()
    expect(screen.getByText("Control de importes actuales")).toBeInTheDocument()
  })

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

    const quickClose = screen.getByRole("button", { name: "Cerrar turno sin información" })
    expect(quickClose).toBeDisabled()
    await user.click(screen.getByRole("checkbox", { name: "Producción revisada" }))
    await user.click(screen.getByRole("checkbox", { name: "Mermas revisadas" }))
    await user.click(quickClose)

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      noInformation: true,
      productionReviewed: true,
      wasteReviewed: true,
    }))
  })

  it("uses local OCR assets when reading a closing ticket", async () => {
    const user = userEvent.setup()
    const worker = {
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({ data: { text: "Número de cierre de caja 1692" } }),
      terminate: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(createWorker).mockResolvedValue(worker as any)

    render(
      <ShiftCloseModal
        shift={shift}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        saving={false}
      />,
    )

    const file = new File(["image"], "cierre.jpeg", { type: "image/jpeg" })
    const fileInputs = document.querySelectorAll<HTMLInputElement>("input[type='file']")
    await user.upload(fileInputs[1], file)

    await screen.findByText("Lectura completada. Revisa todos los campos antes de confirmar.")
    expect(createWorker).toHaveBeenCalledWith("spa", 1, expect.objectContaining({
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-lstm.wasm.js",
      langPath: "/tesseract/lang",
      workerBlobURL: false,
      gzip: true,
    }))
  })
})
