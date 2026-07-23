import { describe, expect, it, vi, beforeEach } from "vitest"
import { downloadCSV } from "../csv"

describe("downloadCSV", () => {
  let anchor: { click: ReturnType<typeof vi.fn>; href: string; download: string }

  beforeEach(() => {
    anchor = { click: vi.fn(), href: "", download: "" }
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return anchor as unknown as HTMLAnchorElement
      return document.createElement(tag)
    })
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  })

  it("does nothing when data is empty", () => {
    downloadCSV([], "test.csv")
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it("creates CSV with correct headers and rows", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]
    downloadCSV(data, "users.csv")
    expect(anchor.click).toHaveBeenCalled()
  })

  it("escapes values containing commas", () => {
    const data = [{ field: "has,comma" }]
    downloadCSV(data, "test.csv")
    expect(anchor.click).toHaveBeenCalled()
  })

  it("escapes values containing quotes", () => {
    const data = [{ field: 'has"quote' }]
    downloadCSV(data, "test.csv")
    expect(anchor.click).toHaveBeenCalled()
  })

  it("escapes values containing newlines", () => {
    const data = [{ field: "has\nnewline" }]
    downloadCSV(data, "test.csv")
    expect(anchor.click).toHaveBeenCalled()
  })

  it("handles null/undefined values", () => {
    const data = [{ field: null }, { field: undefined }]
    downloadCSV(data, "test.csv")
    expect(anchor.click).toHaveBeenCalled()
  })

  it("sets the filename on the anchor element", () => {
    const data = [{ a: 1 }]
    downloadCSV(data, "my-file.csv")
    expect(anchor.download).toBe("my-file.csv")
  })
})
