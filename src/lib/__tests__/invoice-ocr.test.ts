import { describe, expect, it } from "vitest"
import { parseInvoiceText } from "../invoice-ocr"
import { invoiceDraftToAccounting } from "../accounting-invoices"

describe("parseInvoiceText", () => {
  it("parses Yolmar PDF layout with invoice number and all product lines", () => {
    const text = [
      "Factura",
      "HIJOS DE GONZALEZ Y CORREA SL",
      "B80895410",
      "C/ DINAMARCA 9, 28802, ALCALÁ DE HENARES, MADRID",
      "Fecha de Factura: 15/08/2026",
      "CIF/NIF: B09711078",
      "Número de Factura: 9960/3776",
      "Fecha de Pago: 20/08/2026 0:00:00",
      "Forma de Pago Contado/Efectivo",
      "PEDIDOS FACTURADOS",
      "Número: 7517 Fecha: 11/08/2026 Centro: Calle Doctor Esquerdo 180",
      "N.REF. ARTICULO U.MEDIDA CANTIDAD DTO PVP Neto IVA.% IVA IMP.NETO",
      "380 Luisitos Variados (Kg) Kilo 6,000 0,00 13,50 10% 8,10 81,00",
      "Lote: 0000812608111 Caducidad: 16/08/2026 0:00:00",
      "395 Mini Cuernos Dulce Leche (Kg) Kilo 1,000 0,00 14,50 10% 1,45 14,50",
      "399 Mini Cuernos Lotus (Kg) Kilo 1,000 0,00 14,50 10% 1,45 14,50",
      "441 Borracho Unidad 10,000 0,00 1,85 10% 1,85 18,50",
      "447 Milhoja Unidad 6,000 0,00 1,70 10% 1,02 10,20",
      "515 Tarta Lotus 2.Mini Unidad 1,000 0,00 13,00 10% 1,30 13,00",
      "517 Tarta Lotus 4.Grande Unidad 1,000 0,00 18,50 10% 1,85 18,50",
      "551 Tarta Sácher 4.Grande Unidad 1,000 0,00 18,50 10% 1,85 18,50",
      "Sin IVA / Exento: 0,00 % IVA RE % RE TT.Desc: Total Neto: 188,70",
      "Superreducido: 0,00 4% 0,00 0,00 Total IVA: 18,87",
      "Reducido: 188,70 10% 18,87 Total RE: 0,00",
      "Normal: 0,00 21% 0,00 Total Bruto: 207,57",
      "Total Neto: 188,70",
      "Total IVA: 18,87",
      "Total Bruto: 207,57",
    ].join("\n")

    const draft = parseInvoiceText(text)

    expect(draft.series).toBe("9960")
    expect(draft.number).toBe("3776")
    expect(draft.paymentDate).toBe("2026-08-20")
    expect(draft.orderNumber).toBe("7517")
    expect(draft.orderDate).toBe("2026-08-11")
    expect(draft.deliveryCenter).toBe("Calle Doctor Esquerdo 180")
    expect(draft.issuerTaxId).toBe("B80895410")
    expect(draft.lines).toHaveLength(8)
    expect(draft.lines[0]).toMatchObject({ supplierReference: "380", quantity: "6.00", unitPrice: "13.50", lineTotal: "81.00" })
    expect(draft.netTotal).toBe("188.70")
    expect(draft.discountTotal).toBe("0.00")
    expect(draft.totalVat).toBe("18.87")
    expect(draft.totalAmount).toBe("207.57")
    expect(draft.taxes).toEqual([
      { type: "IVA", percentage: "0.00", taxableBase: "0.00", taxAmount: "0.00" },
      { type: "IVA", percentage: "4.00", taxableBase: "0.00", taxAmount: "0.00" },
      { type: "IVA", percentage: "10.00", taxableBase: "188.70", taxAmount: "18.87" },
      { type: "IVA", percentage: "21.00", taxableBase: "0.00", taxAmount: "0.00" },
    ])
  })

  it("parses Lácteos Guerrero mixed-IVA layout", () => {
    const text = [
      "FACTURA FAC-2026 / 8740",
      "LACTEOS GUERRERO SL",
      "NIF: B09816158",
      "CALLE LEON NO. 24",
      "FECHA DE EMISIÓN VENCIMIENTO CIF/DNI",
      "28500 ARGANDA DEL REY MADRID (España)",
      "Teléfono: 670100157 Móvil: 670100157 11/08/2026 11/08/2026 B09711078",
      "C/DOCTOR ESQUERDO 180",
      "10/08/2026 ALB-2026 / 10248",
      "512 CACHITOS TRADICIONAL PRE-COCIDOS X40 20260716 16/10/26 4 Caja 40 1,270 € 203,200 € 10%",
      "664 MALTIN POLAR BOTELLA 24X250 ML L6DF1078 12/06/27 1 Caja 24 0,790 € 18,960 € 21%",
      "CONDICIONES PARA TRANSFERENCIA BANCARIA:",
      "BASE IMPONIBLE IMPUESTO % BASE IMPUESTO CUOTA IMPUESTO TOTAL",
      "IVA 10,00 % 203,20 € 20,32 €",
      "222,16 €",
      "246,46 €",
      "IVA 21,00 % 18,96 € 3,98 €",
    ].join("\n")

    const draft = parseInvoiceText(text)
    expect(draft.series).toBe("FAC-2026")
    expect(draft.number).toBe("8740")
    expect(draft.issueDate).toBe("2026-08-11")
    expect(draft.dueDate).toBe("2026-08-11")
    expect(draft.issuerTaxId).toBe("B09816158")
    expect(draft.issuerLegalName).toBe("LACTEOS GUERRERO SL")
    expect(draft.issuerBillingAddress).toContain("CALLE LEON NO. 24")
    expect(draft.paymentMethod).toBe("Transferencia bancaria")
    expect(draft.deliveryNoteReference).toBe("ALB-2026/10248")
    expect(draft.deliveryNoteDate).toBe("2026-08-10")
    expect(draft.lines).toHaveLength(2)
    expect(draft.lines[0]).toMatchObject({ supplierReference: "512", quantity: "4.00", originalFormat: "Caja 40", unitPrice: "1.27", taxableBase: "203.20", vatRate: "10.00", batch: "20260716", dueDate: "2026-10-16" })
    expect(draft.lines[1]).toMatchObject({ supplierReference: "664", quantity: "1.00", originalFormat: "Caja 24", unitPrice: "0.79", taxableBase: "18.96", vatRate: "21.00", batch: "L6DF1078", dueDate: "2027-06-12" })
    expect(draft.netTotal).toBe("222.16")
    expect(draft.totalVat).toBe("24.30")
    expect(draft.totalAmount).toBe("246.46")
  })

  it("parses IKEA receipt lines and recovers a missing final amount from the ticket total", () => {
    const text = [
      "FACTURA ORDINARIA",
      "B09711078",
      "ORD_031_2026/0021751",
      "Fecha Factura: 22/05/2026",
      "Art/ EA 00536247 17103",
      "ROSENMANDEL cart opac 20 135x300",
      "29,99 0",
      "Art/ EA 30567671 12011",
      "STRIMWIG plat postre 21 gres gri",
      "3 14,99 44,97 0",
      "Art/ EA 50175276 22195",
      "TREA 965+ GUNSTIG salvnantéiman",
      "6,99 0",
      "Art/ EA 50091762 22185",
      "DRAGON N cuchar café 11 acero in",
      "6,990",
      "Art/ EA 00444554 18117",
      "GRILLTIDER breia bbsoa elieonas 7",
      "Total 89,93",
      "CÓDIGO TIPO BASE IMP. 1VA",
      "0 21,04 74,34 15,59",
      "CIF: A-26812618",
    ].join("\n")

    const draft = parseInvoiceText(text)

    expect(draft.series).toBe("ORD_031_2026")
    expect(draft.number).toBe("0021751")
    expect(draft.issuerTaxId).toBe("A-28812618")
    expect(draft.lines).toHaveLength(5)
    expect(draft.lines.map((line) => line.itemCode)).toEqual(["17103", "12011", "22195", "22185", "18117"])
    expect(draft.lines.map((line) => line.description)).toEqual([
      "ROSENMANDEL cort opac 2u 135x300",
      "STRIMMIG plat postre 21 gres gri",
      "IKEA 365+ GUNSTIG salvamant&imán",
      "DRAGON N cuchar café 11 acero in",
      "GRILLTIDER brcha bbcoa silicona",
    ])
    expect(draft.lines.map((line) => line.lineTotal)).toEqual(["29.99", "44.97", "6.99", "6.99", "0.99"])
    expect(draft.netTotal).toBe("74.34")
    expect(draft.totalVat).toBe("15.59")
    expect(draft.totalAmount).toBe("89.93")
  })

  it("parses IKEA tax rows when OCR misreads IMP and IVA in the header", () => {
    const draft = parseInvoiceText([
      "FACTURA ORDINARIA",
      "TREA IBERICA S.A.",
      "N° FACTURA: ORD_081_2026/0021751",
      "FECHA FACTURA: 22/05/2026",
      "ART/ EA 00536247 17103",
      "ROSENMANDEL CONT OPAC 20 135X300",
      "29,99 0",
      "TOTAL 89,93",
      "CÓDIGO TIPO BASE INP. VA",
      "0 21,0 % 74,34 15,59",
      "N°. CAJERO: 118 1",
    ].join("\n"))

    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "74.34", taxAmount: "15.59" }])
    expect(draft.netTotal).toBe("74.34")
    expect(draft.totalVat).toBe("15.59")
  })

  it("parses Coca-Cola invoices with plain invoice numbers, dotted dates and SEPA payment", () => {
    const draft = parseInvoiceText([
      "Número de cuenta de Coca-Cola EP: 19120357 Número factura: 2723824287",
      "ENV/2023/000003130",
      "RAZÓN SOCIAL DIRECCIÓN DE ENVÍO",
      "FANS COFFEE FRIENDS, S.L.L FANS COFFEE FRIENDS, S.L.L",
      "CIF/NIF: B09711078",
      "DOCUMENTO NÚMERO FECHA FORMA DE PAGO GRUPO DE COBRO FECHA VTO PÁG",
      "Factura 2723824287 06.07.2026 SEPA DOMI RECIBOS CLIENTES 13.07.2026 1/1",
      "CÓDIGO EAN ART. DESCRIPCIÓN CANTIDAD PRECIO BASE DTO IMPORTE T",
      "5449000000996 350080 COCACOLA LATA33 C24 2,00 39,36 78,72",
      "TOTAL PRODUCTOS 64,54",
      "TIPO BASE IMPONIBLE % IMPUESTOS IMPORTE",
      "64,89 IVA 21 % 13,63",
      "TOTAL BASES: 64,89 TOTAL IMPUESTOS: 13,63 TOTAL: 78,52 EUROS",
      "C.I.F. B-86561412",
    ].join("\n"))

    expect(draft.number).toBe("2723824287")
    expect(draft.issueDate).toBe("2026-07-06")
    expect(draft.paymentMethod).toBe("SEPA DOMI")
    expect(draft.netTotal).toBe("64.89")
    expect(draft.totalVat).toBe("13.63")
    expect(draft.totalAmount).toBe("78.52")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "64.89", taxAmount: "13.63" }])
    expect(invoiceDraftToAccounting(draft, "")).toMatchObject({ base21: "64.89", vat21: "13.63", supplierOrCreditor: "" })
  })

  it("covers OCR fallback branches and alternate value layouts", () => {
    const draft = parseInvoiceText([
      "CIF: A-99999999",
      "A09711078",
      "Forma de Pago:",
      "Contado",
      "Total Bruto:",
      "12,34",
    ].join("\n"))
    expect(draft.issuerTaxId).toBe("A99999999")
    expect(draft.validRecipientTaxId).toBe(true)
    expect(draft.paymentMethod).toBe("Contado")
    expect(draft.totalAmount).toBe("12.34")

    expect(parseInvoiceText("09711078").validRecipientTaxId).toBe(true)
    expect(parseInvoiceText("A-28812618").validRecipientTaxId).toBe(false)
    expect(parseInvoiceText("CIF: A-28812618").issuerTaxId).toBe("A-28812618")
    expect(parseInvoiceText("CIF-B09711078").issuerTaxId).toBe("B09711078")

    const companyFallback = parseInvoiceText("ACME S.L.\nCalle Mayor 1\n28007 Madrid")
    expect(companyFallback.issuerLegalName).toBe("ACME S.L.")
    expect(companyFallback.issuerBillingAddress).toContain("Calle Mayor 1")

    const yolmarWithoutLot = parseInvoiceText("123 Producto Kilo 2,00 0,00 3,00 10% 0,60 6,00\nCaducidad: 01/01/27")
    expect(yolmarWithoutLot.lines[0]).toMatchObject({ supplierReference: "123", batch: "", dueDate: "2027-01-01" })

    const generic = parseInvoiceText("123 Producto de prueba 2,00 Caja 3,00 6,00 10%")
    expect(generic.lines[0]).toMatchObject({ supplierReference: "123", originalFormat: "123 Producto de prueba 2,00 Caja 3,00 6,00 10%", quantity: "2.00", unitPrice: "3.00", taxableBase: "6.00" })

    const cashFallback = parseInvoiceText("Saldo: 12,34\nEfectivo 20,00")
    expect(cashFallback.totalAmount).toBe("12.34")

    const standaloneTotal = parseInvoiceText("BASE IMPONIBLE TOTAL\n10% 1,00 0,10\n123,45")
    expect(standaloneTotal.totalAmount).toBe("123.45")

    const protectedText = parseInvoiceText("BASE IMPONIBLE TOTAL\nProtección de datos personales\n123,45")
    expect(protectedText.totalAmount).toBe("0")

    const legacyNumberFallback = parseInvoiceText("ABC-1-2/3")
    expect(legacyNumberFallback.series).toBe("ABC-1-2")
    expect(legacyNumberFallback.number).toBe("3")
  })
})
