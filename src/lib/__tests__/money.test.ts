import { describe, expect, it } from "vitest"
import { toN, sum, sub, toJSON, toFixed } from "../money"

describe("toN", () => {
  it("returns 0 for null/undefined", () => {
    expect(toN(null)).toBe(0)
    expect(toN(undefined)).toBe(0)
  })

  it("returns number as-is", () => {
    expect(toN(42)).toBe(42)
    expect(toN(0)).toBe(0)
    expect(toN(-3.14)).toBe(-3.14)
  })

  it("parses string numbers", () => {
    expect(toN("100")).toBe(100)
    expect(toN("3.14")).toBe(3.14)
    expect(toN("-50.5")).toBe(-50.5)
  })

  it("converts objects with toString()", () => {
    const decimal = { toString: () => "123.45" }
    expect(toN(decimal)).toBe(123.45)
  })

  it("returns 0 for non-numeric strings", () => {
    expect(toN("abc")).toBeNaN()
  })
})

describe("sum", () => {
  it("returns 0 for empty args", () => {
    expect(sum()).toBe(0)
  })

  it("sums multiple numbers", () => {
    expect(sum(1, 2, 3)).toBe(6)
  })

  it("sums mixed types", () => {
    expect(sum(10, "20", { toString: () => "30" })).toBe(60)
  })

  it("handles null/undefined in args", () => {
    expect(sum(10, null, undefined, 5)).toBe(15)
  })
})

describe("sub", () => {
  it("subtracts two numbers", () => {
    expect(sub(10, 3)).toBe(7)
  })

  it("handles mixed types", () => {
    expect(sub("100", 25)).toBe(75)
  })

  it("returns negative result", () => {
    expect(sub(5, 10)).toBe(-5)
  })
})

describe("toJSON", () => {
  it("rounds to 2 decimals", () => {
    expect(toJSON(1.235)).toBe(1.24)
    expect(toJSON(1.234)).toBe(1.23)
  })

  it("handles whole numbers", () => {
    expect(toJSON(100)).toBe(100)
  })

  it("handles null", () => {
    expect(toJSON(null)).toBe(0)
  })

  it("handles string input", () => {
    expect(toJSON("45.678")).toBe(45.68)
  })
})

describe("toFixed", () => {
  it("formats to 2 decimals by default", () => {
    expect(toFixed(10)).toBe("10.00")
    expect(toFixed(3.14159)).toBe("3.14")
    expect(toFixed(2.5)).toBe("2.50")
  })

  it("respects custom decimals", () => {
    expect(toFixed(3.14159, 4)).toBe("3.1416")
    expect(toFixed(1, 0)).toBe("1")
  })

  it("handles null", () => {
    expect(toFixed(null)).toBe("0.00")
  })

  it("handles object with toString", () => {
    expect(toFixed({ toString: () => "99.9" })).toBe("99.90")
  })
})
