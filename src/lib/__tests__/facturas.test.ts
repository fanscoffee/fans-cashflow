import { describe, expect, it } from "vitest"
import {
  buildInvoiceAlerts,
  facturaLineaSchema,
  facturaSchema,
  normalizeNif,
  type FacturaInput,
} from "../facturas"

function makeLine(overrides: Partial<FacturaInput["lineas"][number]> = {}) {
  return facturaLineaSchema.parse({
    productoId: "product-1",
    tipoLinea: "PRODUCTO",
    descripcion: "Harina",
    cantidad: 2,
    descuentoImporte: 0,
    precioUnitario: 5,
    precioUnitarioNeto: 5,
    baseImponible: 10,
    cuotaIva: 2.1,
    totalLinea: 12.1,
    ...overrides,
  })
}

function makeInvoice(overrides: Partial<FacturaInput> = {}) {
  return facturaSchema.parse({
    proveedorId: "provider-1",
    cifReceptor: "B09711078",
    numero: "42",
    fechaExpedicion: "2026-08-01",
    razonSocialEmisor: "Proveedor de prueba",
    nifEmisor: "B12345678",
    domicilioFiscalEmisor: "Calle Mayor 1",
    totalNeto: 10,
    totalDescuento: 0,
    totalIva: 2.1,
    totalRecargo: 0,
    totalRetenciones: 0,
    importeTotal: 12.1,
    recepcionIds: ["reception-1"],
    lineas: [makeLine()],
    ...overrides,
  })
}

function makeReceived(overrides: Partial<Parameters<typeof buildInvoiceAlerts>[1][number]> = {}) {
  return {
    productoId: "product-1",
    cantidadRecibida: 2,
    precioUnitario: 5,
    producto: { codigo: "P-1", descripcionTpv: "Harina" },
    ...overrides,
  }
}

describe("facturas", () => {
  it("normalizes NIFs and skips validation without linked receptions", () => {
    expect(normalizeNif(" b-097 110.78 ")).toBe("B09711078")
    expect(buildInvoiceAlerts(makeInvoice({ recepcionIds: [] }), [])).toEqual({
      alerts: [],
      lineAlerts: new Map(),
    })
  })

  it("aggregates repeated product lines and ignores cargo lines", () => {
    const invoice = makeInvoice({
      lineas: [
        makeLine({ cantidad: 1, baseImponible: 5, totalLinea: 6.05 }),
        makeLine({ cantidad: 1, baseImponible: 5, totalLinea: 6.05 }),
        makeLine({ productoId: null, tipoLinea: "CARGO", descripcion: "Transporte" }),
      ],
    })

    const result = buildInvoiceAlerts(invoice, [
      makeReceived({ cantidadRecibida: 1 }),
      makeReceived({ cantidadRecibida: 1 }),
    ])

    expect(result.alerts).toEqual([])
    expect(result.lineAlerts).toEqual(new Map())
  })

  it("reports products billed without a reception and products received without billing", () => {
    const missingProductMessage = "Producto facturado no aparece en los albaranes vinculados"
    const receivedProductMessage = "Producto recibido en albarán no aparece en la factura"
    const invoice = makeInvoice({
      lineas: [
        makeLine({ productoId: "product-missing", descripcion: "Producto faltante" }),
        makeLine({ productoId: "product-missing", descripcion: "Producto faltante 2" }),
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
      makeInvoice({ lineas: [makeLine({ cantidad: 3, baseImponible: 15, totalLinea: 18.15 })] }),
      [makeReceived({ cantidadRecibida: 2 })],
    )
    const priceResult = buildInvoiceAlerts(
      makeInvoice({ lineas: [makeLine({ precioUnitario: 7, precioUnitarioNeto: 7, baseImponible: 14, totalLinea: 16.94 })] }),
      [makeReceived()],
    )

    expect(quantityResult.alerts).toEqual(["Diferencia con albarán: cantidad factura 3 vs albarán 2"])
    expect(priceResult.alerts).toEqual(["Diferencia con albarán: precio neto factura 7.0000 vs albarán 5.0000"])
  })

  it("reports both differences and handles zero quantities without false price alerts", () => {
    const invoice = makeInvoice({
      lineas: [
        makeLine({ productoId: "product-both", cantidad: 3, precioUnitario: 7, precioUnitarioNeto: 7 }),
        makeLine({ productoId: "product-zero", cantidad: 0, precioUnitario: 5, precioUnitarioNeto: 5 }),
      ],
    })
    const result = buildInvoiceAlerts(invoice, [
      makeReceived({ productoId: "product-both", cantidadRecibida: 2 }),
      makeReceived({ productoId: "product-zero", cantidadRecibida: 0, precioUnitario: 4 }),
    ])

    expect(result.alerts).toEqual(["Diferencia con albarán: cantidad factura 3 vs albarán 2; precio neto factura 7.0000 vs albarán 5.0000"])
    expect(result.lineAlerts.get(0)).toBe(result.alerts[0])
    expect(result.lineAlerts.has(1)).toBe(false)
  })
})
