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

  it("shows server errors inside the close modal", () => {
    render(
      <ShiftCloseModal
        shift={shift}
        requirePhoto={false}
        submitError="La fecha y hora del ticket no son válidas"
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        saving={false}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("La fecha y hora del ticket no son válidas")
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

  it("keeps shift cash independent from ticket cash during OCR and manual edits", async () => {
    const user = userEvent.setup()
    const ticketText = `
      Resumen de ventas
      Ventas brutas €1.178,45
      Reembolsos €0,00
      Descuentos €0,00
      Ventas netas €1.178,45
      Efectivo €420,00
      Por tarjeta €758,45
      Impuestos
      Iva Pan, 4% base imp €28,08
      Iva Pan, 4% cuota €1,12
      IVA, 10% base Imp €1.044,80
      IVA, 10% cuota €104,45
    `
    const worker = {
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({ data: { text: ticketText } }),
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

    const shiftCash = screen.getByLabelText(/Efectivo del turno/)
    await user.clear(shiftCash)
    await user.type(shiftCash, "137.50")

    const file = new File(["image"], "cierre.jpeg", { type: "image/jpeg" })
    const fileInputs = document.querySelectorAll<HTMLInputElement>("input[type='file']")
    await user.upload(fileInputs[1], file)

    await screen.findByText("Lectura completada. Revisa todos los campos antes de confirmar.")
    const ticketCash = screen.getByLabelText(/Efectivo ticket/)
    expect(ticketCash).toHaveValue(420)
    expect(shiftCash).toHaveValue(137.5)

    await user.clear(ticketCash)
    await user.type(ticketCash, "425")
    expect(ticketCash).toHaveValue(425)
    expect(shiftCash).toHaveValue(137.5)
  })
})
