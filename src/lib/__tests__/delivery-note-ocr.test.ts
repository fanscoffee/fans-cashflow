import { describe, expect, it } from "vitest"
import {
  grossAmountToNet,
  grossLineTotalToNetUnitPrice,
  matchDeliveryProduct,
  parseDeliveryNoteText,
  validateDeliveryNoteFiscalBreakdown,
} from "../delivery-note-ocr"

const mercadonaText = `
Pedido Nº 33532404
Factura simplificada 4463 - 90 - 46122
Entrega lunes 5 de 13:00 a 14:00h
Cobrado el 05/10/26 a las 07:22
Nombre Producto Cantidad entregada PVP
Queso untar suave de vaca Hacendado 2 2,80 €
Banana 2 0,56 €
- Peso: 0,360 kg Precio kg: 1,55 €
Tomates 22 92,40 €
Productos 392,95 €
Coste de preparación 8,20 €
TOTAL 401,15 €
Desglose de impuestos
IVA Base Cuota
21% 15,19 € 3,18 €
10% 102,16 € 10,22 €
4% 260,00 € 10,40 €
Total 377,35 € 23,80 €
MERCADONA.S.A | A-46103834 | Calle Alfonso Roig Alfonso, s/n.
`

describe("delivery-note-ocr", () => {
  it("extracts a Mercadona order, date, costs and product rows", () => {
    expect(parseDeliveryNoteText(mercadonaText)).toMatchObject({
      supplierName: "MERCADONA.S.A",
      supplierTaxId: "A46103834",
      deliveryNoteCode: "33532404",
      receivedAt: "2026-10-05",
      preparationGross: "8.20",
      totalAmount: "401.15",
      taxes: [
        { percentage: "4.00", taxableBase: "260.00", taxAmount: "10.40" },
        { percentage: "10.00", taxableBase: "102.16", taxAmount: "10.22" },
        { percentage: "21.00", taxableBase: "15.19", taxAmount: "3.18" },
      ],
      lines: [
        { description: "Queso untar suave de vaca Hacendado", quantity: "2", lineTotal: "2.80" },
        { description: "Banana", quantity: "2", lineTotal: "0.56" },
        { description: "Tomates", quantity: "22", lineTotal: "92.40" },
      ],
    })
  })

  it("matches catalog products conservatively and converts gross line totals", () => {
    const products = [
      { id: "tomato", code: "TOM-1", posDescription: "Tomates" },
      { id: "banana", code: "BAN-1", posDescription: "Banana" },
    ]

    expect(matchDeliveryProduct("Tomates", products)?.id).toBe("tomato")
    expect(matchDeliveryProduct("Producto desconocido", products)).toBeNull()
    expect(grossLineTotalToNetUnitPrice("92.40", "22", 4)).toBe(4.0385)
  })

  it("joins product descriptions split from quantity and price by PDF columns", () => {
    const draft = parseDeliveryNoteText(`
      Pedido Nº 12345678
      Cobrado el 05/10/26 a las 07:22
      Nombre Producto Cantidad entregada PVP
      Banana
      2 0,56 €
      Productos 0,56 €
      Coste de preparación 0,00 €
      TOTAL 0,56 €
      MERCADONA.S.A | A-46103834
    `)

    expect(draft.lines).toEqual([{ description: "Banana", quantity: "2", lineTotal: "0.56" }])
  })

  it("converts preparation cost to net and validates the aggregated tax summary", () => {
    expect(grossAmountToNet("8,20", 21)).toBe(6.7769)

    const validation = validateDeliveryNoteFiscalBreakdown({
      lines: [{ quantity: 22, netUnitPrice: 4.0385, vatPercentage: 4, grossLineTotal: 92.4 }],
      taxes: [
        { percentage: "4.00", taxableBase: "88.85", taxAmount: "3.55" },
        { percentage: "21.00", taxableBase: "6.78", taxAmount: "1.42" },
      ],
      preparationGross: 8.2,
      preparationNet: 6.7769,
      totalGross: 100.6,
    })

    expect(validation).toMatchObject({ valid: true, preparationVatPercentage: 21, preparationNet: 6.7769, warnings: [] })
    expect(validation.calculatedTaxes).toEqual([
      { percentage: "4.00", taxableBase: "88.85", taxAmount: "3.55" },
      { percentage: "21.00", taxableBase: "6.78", taxAmount: "1.42" },
    ])
  })
})
