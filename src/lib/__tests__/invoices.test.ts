import { describe, expect, it } from "vitest"
import {
  buildInvoiceAlerts,
  invoiceLineSchema,
  invoiceSchema,
  normalizeTaxId,
  type InvoiceInput,
} from "../invoices"

function makeLine(overrides: Partial<InvoiceInput["lines"][number]> = {}) {
  return invoiceLineSchema.parse({
    productId: "product-1",
    lineType: "PRODUCTO",
    description: "Harina",
    quantity: 2,
    discountAmount: 0,
    unitPrice: 5,
    netUnitPrice: 5,
    taxableBase: 10,
    vatAmount: 2.1,
    lineTotal: 12.1,
    ...overrides,
  })
}

function makeInvoice(overrides: Partial<InvoiceInput> = {}) {
  return invoiceSchema.parse({
    supplierId: "provider-1",
    recipientTaxId: "B09711078",
    number: "42",
    issueDate: "2026-08-01",
    issuerLegalName: "Proveedor de prueba",
    issuerTaxId: "B12345678",
    issuerBillingAddress: "Calle Mayor 1",
    netTotal: 10,
    discountTotal: 0,
    totalVat: 2.1,
    surchargeTotal: 0,
    withholdingTotal: 0,
    totalAmount: 12.1,
    receiptIds: ["reception-1"],
    lines: [makeLine()],
    ...overrides,
  })
}

function makeReceived(overrides: Partial<Parameters<typeof buildInvoiceAlerts>[1][number]> = {}) {
  return {
    productId: "product-1",
    receivedQuantity: 2,
    unitPrice: 5,
    product: { code: "P-1", posDescription: "Harina" },
    ...overrides,
  }
}

describe("invoices", () => {
  it("normalizes tax IDs and skips validation without linked receptions", () => {
    expect(normalizeTaxId(" b-097 110.78 ")).toBe("B09711078")
    expect(buildInvoiceAlerts(makeInvoice({ receiptIds: [] }), [])).toEqual({
      alerts: [],
      lineAlerts: new Map(),
    })
  })

  it("aggregates repeated product lines and ignores cargo lines", () => {
    const invoice = makeInvoice({
      lines: [
        makeLine({ quantity: 1, taxableBase: 5, lineTotal: 6.05 }),
        makeLine({ quantity: 1, taxableBase: 5, lineTotal: 6.05 }),
        makeLine({ productId: null, lineType: "CARGO", description: "Transporte" }),
      ],
    })

    const result = buildInvoiceAlerts(invoice, [
      makeReceived({ receivedQuantity: 1 }),
      makeReceived({ receivedQuantity: 1 }),
    ])

    expect(result.alerts).toEqual([])
    expect(result.lineAlerts).toEqual(new Map())
  })

  it("reports products billed without a reception and products received without billing", () => {
    const missingProductMessage = "Producto facturado no aparece en los albaranes vinculados"
    const receivedProductMessage = "Producto recibido en albarán no aparece en la factura"
    const invoice = makeInvoice({
      lines: [
        makeLine({ productId: "product-missing", description: "Producto faltante" }),
        makeLine({ productId: "product-missing", description: "Producto faltante 2" }),
      ],
    })

    const result = buildInvoiceAlerts(invoice, [makeReceived()])

    expect(result.alerts).toEqual([missingProductMessage, receivedProductMessage])
    expect(result.lineAlerts).toEqual(new Map([
      [0, missingProductMessage],
      [1, missingProductMessage],
    ]))
  })

  it("reports quantity-only and price-only differences", () => {
    const quantityResult = buildInvoiceAlerts(
      makeInvoice({ lines: [makeLine({ quantity: 3, taxableBase: 15, lineTotal: 18.15 })] }),
      [makeReceived({ receivedQuantity: 2 })],
    )
    const priceResult = buildInvoiceAlerts(
      makeInvoice({ lines: [makeLine({ unitPrice: 7, netUnitPrice: 7, taxableBase: 14, lineTotal: 16.94 })] }),
      [makeReceived()],
    )

    expect(quantityResult.alerts).toEqual(["Diferencia con albarán: cantidad factura 3 vs albarán 2"])
    expect(priceResult.alerts).toEqual(["Diferencia con albarán: precio neto factura 7.0000 vs albarán 5.0000"])
  })

  it("reports both differences and handles zero quantities without false price alerts", () => {
    const invoice = makeInvoice({
      lines: [
        makeLine({ productId: "product-both", quantity: 3, unitPrice: 7, netUnitPrice: 7 }),
        makeLine({ productId: "product-zero", quantity: 0, unitPrice: 5, netUnitPrice: 5 }),
      ],
    })
    const result = buildInvoiceAlerts(invoice, [
      makeReceived({ productId: "product-both", receivedQuantity: 2 }),
      makeReceived({ productId: "product-zero", receivedQuantity: 0, unitPrice: 4 }),
    ])

    expect(result.alerts).toEqual(["Diferencia con albarán: cantidad factura 3 vs albarán 2; precio neto factura 7.0000 vs albarán 5.0000"])
    expect(result.lineAlerts.get(0)).toBe(result.alerts[0])
    expect(result.lineAlerts.has(1)).toBe(false)
  })
})
