import { describe, expect, it } from "vitest"
import { canDeleteInventoryItems, canRegisterInventoryReception } from "../inventory-permissions"

describe("canDeleteInventoryItems", () => {
  it("allows ADMIN", () => {
    expect(canDeleteInventoryItems({ role: "ADMIN" })).toBe(true)
  })

  it("allows only the PARTNER named Yomi", () => {
    expect(canDeleteInventoryItems({ role: "SOCIO", name: "Yomi" })).toBe(true)
    expect(canDeleteInventoryItems({ role: "SOCIO", name: " yomi " })).toBe(true)
    expect(canDeleteInventoryItems({ role: "SOCIO", name: "Ana" })).toBe(false)
    expect(canDeleteInventoryItems({ role: "EMPLEADO", name: "Yomi" })).toBe(false)
  })
})

describe("canRegisterInventoryReception", () => {
  it("allows ADMIN, PARTNER and EMPLOYEE", () => {
    expect(canRegisterInventoryReception({ role: "ADMIN" })).toBe(true)
    expect(canRegisterInventoryReception({ role: "SOCIO" })).toBe(true)
    expect(canRegisterInventoryReception({ role: "EMPLEADO" })).toBe(true)
  })

  it("blocks BAKERY and anonymous users", () => {
    expect(canRegisterInventoryReception({ role: "OBRADOR" })).toBe(false)
    expect(canRegisterInventoryReception(null)).toBe(false)
  })
})
