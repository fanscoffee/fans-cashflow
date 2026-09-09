import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
  getDocument: vi.fn(),
}))

vi.mock("tesseract.js", () => ({
  PSM: { SINGLE_BLOCK: 6, SINGLE_COLUMN: 4 },
  createWorker: mocks.createWorker,
}))

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: mocks.getDocument,
}))

import { extractDocument } from "../document-ocr"

describe("extractDocument", () => {
  beforeEach(() => {
    const page = {
      getTextContent: vi.fn(async () => ({ items: [
        { str: "FACTURA 14046", transform: [1, 0, 0, 1, 0, 0] },
        { str: "B09711078", transform: [1, 0, 0, 1, 0, -10] },
        { str: "Base Imponible 667,17 10% 26,51 Total 709,76", transform: [1, 0, 0, 1, 0, -20] },
      ] })),
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    }
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: vi.fn(async () => page) }) })
    mocks.createWorker.mockResolvedValue({
      setParameters: vi.fn(),
      recognize: vi.fn(async () => ({ data: { text: "DCA Okin S.L.\nB84151760" } })),
      terminate: vi.fn(),
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it("supplements a partial PDF text layer with OCR identity lines", async () => {
    const result = await extractDocument(new File(["%PDF-"], "14.pdf", { type: "application/pdf" }), () => {})

    expect(result).toContain("FACTURA 14046")
    expect(result).toContain("DCA Okin S.L.")
    expect(result).toContain("B84151760")
    expect(mocks.createWorker).toHaveBeenCalledWith("spa+eng", 1, expect.objectContaining({
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-lstm.wasm.js",
      langPath: "/tesseract/lang",
      workerBlobURL: false,
      gzip: true,
    }))
  })

  it("does not wait forever when the local OCR worker does not initialize", async () => {
    vi.useFakeTimers()
    mocks.createWorker.mockReturnValue(new Promise(() => {}))

    const extraction = extractDocument(new File(["image"], "image.png", { type: "image/png" }), () => {})
    await vi.waitFor(() => expect(mocks.createWorker).toHaveBeenCalled())

    const expectedError = expect(extraction).rejects.toThrow("El OCR local no respondió a tiempo")
    await vi.advanceTimersByTimeAsync(45_000)
    await expectedError
  })
})
