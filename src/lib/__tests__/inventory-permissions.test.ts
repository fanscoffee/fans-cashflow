import { describe, expect, it } from "vitest"
import { canDeleteInventoryItems } from "../inventory-permissions"

describe("canDeleteInventoryItems", () => {
  it("allows ADMIN", () => {
    expect(canDeleteInventoryItems({ role: "ADMIN" })).toBe(true)
  })

  it("allows only the SOCIO named Yomi", () => {
    expect(canDeleteInventoryItems({ role: "SOCIO", name: "Yomi" })).toBe(true)
    expect(canDeleteInventoryItems({ role: "SOCIO", name: " yomi " })).toBe(true)
    expect(canDeleteInventoryItems({ role: "SOCIO", name: "Ana" })).toBe(false)
    expect(canDeleteInventoryItems({ role: "EMPLEADO", name: "Yomi" })).toBe(false)
  })
})
