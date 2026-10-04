import { describe, expect, it } from "vitest"
import { extractShiftTicket, mergeShiftTicketReadings } from "../shift-close-ticket"

const incompleteFullImageOcr = `
Fans Coffee Friends S.L.L.
Madrid
Cuadre de efectivo
Número de cierre de    CAJA: 1695
Apertura del turno
unknown unknown 3/10/26 8.09
Cerrado
unknown unknown 3/10/26 15:04
Fondo de caja anterior €200,00
Cobros en efectivo €420,00
Reembolsos en efectivo €0,00
Efectivo teórico en caja €620,00
Cantidad de efectivo real €620,00
Descuadre €0,00
`

const lowerCropOcr = `
Fondo de caja anterior €200,00
Cobros en efectivo €420,00
Reembolsos en efectivo €0,00
Depositado €0,00
Pagos/Salidas €0,00
Efectivo teórico en caja €620,00
Cantidad de efectivo real €620,00
Descuadre €0,00
Resumen de ventas
Ventas brutas €1.178,45
Reembolsos €0,00
Descuentos €0,00
Ventas netas €1.178,45
Efectivo €420,00
Por tarjeta €758,45
Impuestos
Iva Pan, 4% base imp €28,08
Iva Pan, 4% cuota €1,12
IVA, 10% base Imp €1.044,80
IVA, 10% cuota €104,45
3/10/26 15:04
`

const lowerCropWithoutLabels = `
€200,00
€420,00
€0,00
€0,00
€0,00
€620,00
€620,00
€0,00
€1.178,45
€0,00
€0,00
€1.178,45
€420,00
€758,45
€28,08
€1,12
€1.044,80
€104,45
`

const focusedTaxOcr = `
Impuestos
lva Pan, 4% base imp
€35,58
Iva Pan, 4% cuota
€1,42
IVA, 10% base imp
€815,59
IVA, 10% cuota
€81,51
`

describe("shift close ticket OCR", () => {
  it("does not mistake cash-drawer values for sales when the sales heading is absent", () => {
    const fields = extractShiftTicket(incompleteFullImageOcr)

    expect(fields).toMatchObject({
      cashCloseNumber: "1695",
      openingDateTime: "2026-10-03T08:09",
      closingDateTime: "2026-10-03T15:04",
      grossSales: "",
      refunds: "",
      netSales: "",
      cashSales: "",
      cardSales: "",
    })
  })

  it("extracts every sales and tax value from the reported receipt crop", () => {
    expect(extractShiftTicket(lowerCropOcr)).toMatchObject({
      grossSales: "1178.45",
      refunds: "0.00",
      discounts: "0.00",
      netSales: "1178.45",
      cashSales: "420.00",
      cardSales: "758.45",
      breadVat4Base: "28.08",
      breadVat4Amount: "1.12",
      vat10Base: "1044.80",
      vat10Amount: "104.45",
    })
  })

  it("combines lower receipt amounts with identification from the full image", () => {
    const merged = mergeShiftTicketReadings(
      extractShiftTicket(lowerCropOcr),
      extractShiftTicket(incompleteFullImageOcr),
    )

    expect(merged).toMatchObject({
      cashCloseNumber: "1695",
      openingDateTime: "2026-10-03T08:09",
      closingDateTime: "2026-10-03T15:04",
      grossSales: "1178.45",
      refunds: "0.00",
      discounts: "0.00",
      netSales: "1178.45",
      cashSales: "420.00",
      cardSales: "758.45",
      breadVat4Base: "28.08",
      breadVat4Amount: "1.12",
      vat10Base: "1044.80",
      vat10Amount: "104.45",
    })
  })

  it("recovers sales and taxes when OCR recognizes amounts but loses every heading", () => {
    expect(extractShiftTicket(lowerCropWithoutLabels)).toMatchObject({
      grossSales: "1178.45",
      refunds: "0.00",
      discounts: "0.00",
      netSales: "1178.45",
      cashSales: "420.00",
      cardSales: "758.45",
      breadVat4Base: "28.08",
      breadVat4Amount: "1.12",
      vat10Base: "1044.80",
      vat10Amount: "104.45",
    })
  })

  it("normalizes OCR-confused IVA labels in a focused tax reading", () => {
    expect(extractShiftTicket(focusedTaxOcr)).toMatchObject({
      breadVat4Base: "35.58",
      breadVat4Amount: "1.42",
      vat10Base: "815.59",
      vat10Amount: "81.51",
    })
  })

  it("prefers a coherent focused tax reading over non-empty invalid OCR values", () => {
    const incorrect = extractShiftTicket(`
      Impuestos
      Iva Pan, 4% cuota €1,42
      IVA, 10% base imp €815,59
      IVA, 10% cuota €151
    `)

    expect(mergeShiftTicketReadings(extractShiftTicket(focusedTaxOcr), incorrect)).toMatchObject({
      breadVat4Base: "35.58",
      breadVat4Amount: "1.42",
      vat10Base: "815.59",
      vat10Amount: "81.51",
    })
  })
})
