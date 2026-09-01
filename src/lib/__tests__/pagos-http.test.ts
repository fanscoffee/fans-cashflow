import { describe, expect, it } from "vitest"
import { PaymentDomainError } from "../pagos"
import { parseEntity, paymentErrorResponse } from "../pagos-http"

describe("pagos-http", () => {
  it("parses only supported payment entities", () => {
    expect(parseEntity(undefined)).toBeUndefined()
    expect(parseEntity(null)).toBeUndefined()
    expect(parseEntity("")).toBeUndefined()
    expect(parseEntity("OBRADOR")).toBe("OBRADOR")
    expect(parseEntity("INVALID")).toBeUndefined()
  })

  it("serializes domain errors into an HTTP response", async () => {
    const response = paymentErrorResponse(new PaymentDomainError("No autorizado", 403, "PAYMENT_FORBIDDEN"))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "No autorizado", code: "PAYMENT_FORBIDDEN" })
  })
})
