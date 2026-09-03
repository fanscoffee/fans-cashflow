import { describe, expect, it } from "vitest"
import { PaymentDomainError } from "../payments"
import { parseEntity, paymentErrorResponse } from "../payments-http"

describe("payments-http", () => {
  it("parses only supported payment entities", () => {
    expect(parseEntity(undefined)).toBeUndefined()
    expect(parseEntity(null)).toBeUndefined()
    expect(parseEntity("OBRADOR")).toBe("BAKERY")
    expect(() => parseEntity("")).toThrow("Entidad no válida")
    expect(() => parseEntity("INVALID")).toThrow("Entidad no válida")
  })

  it("serializes domain errors into an HTTP response", async () => {
    const response = paymentErrorResponse(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN" })
  })
})
