import { describe, expect, it } from "vitest"
import { transportsToJSON, transportsFromJSON } from "../webauthn"

describe("transportsToJSON", () => {
  it("returns null for undefined input", () => {
    expect(transportsToJSON(undefined)).toBeNull()
  })

  it("serializes transport array to JSON string", () => {
    expect(transportsToJSON(["internal", "usb"])).toBe('["internal","usb"]')
  })

  it("serializes single transport", () => {
    expect(transportsToJSON(["ble"])).toBe('["ble"]')
  })
})

describe("transportsFromJSON", () => {
  it("returns undefined for null input", () => {
    expect(transportsFromJSON(null)).toBeUndefined()
  })

  it("deserializes JSON string to transport array", () => {
    expect(transportsFromJSON('["nfc","cable"]')).toEqual(["nfc", "cable"])
  })

  it("roundtrips with transportsToJSON", () => {
    const original = ["hybrid", "smart-card"] as const
    const json = transportsToJSON([...original])
    const result = transportsFromJSON(json)
    expect(result).toEqual([...original])
  })
})
