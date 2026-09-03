import { describe, expect, it } from "vitest"
import { uppercaseInputValue, uppercasePersistedValue } from "../uppercase"

describe("uppercase normalization", () => {
  it("uppercases text while preserving Spanish characters", () => {
    expect(uppercaseInputValue("Panadería y azúcar")).toBe("PANADERÍA Y AZÚCAR")
  })

  it("preserves credentials, emails, ids, enums and technical values", () => {
    const value = uppercasePersistedValue({
      name: "Ana García",
      email: "Ana@Example.com",
      contactEmail: "Contacto@Example.com",
      password: "$2a$hash",
      createdById: "cuid-lower",
      shift: "mañana",
      status: "Activo",
      storageKey: "facturas/lower.pdf",
    })

    expect(value).toEqual({
      name: "ANA GARCÍA",
      email: "Ana@Example.com",
      contactEmail: "Contacto@Example.com",
      password: "$2a$hash",
      createdById: "cuid-lower",
      shift: "mañana",
      status: "Activo",
      storageKey: "facturas/lower.pdf",
    })
  })

  it("normalizes nested create data", () => {
    expect(uppercasePersistedValue({ lines: [{ description: "Harina" }] })).toEqual({
      lines: [{ description: "HARINA" }],
    })
  })
})
