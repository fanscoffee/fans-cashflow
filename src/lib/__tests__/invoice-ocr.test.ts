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

  it("parses the IGNIS PDF layout with inline labels and tax breakdown", () => {
    const draft = parseInvoiceText([
      "Loop Electricidad y Gas, S.L. CIF B87095543",
      "B09711078",
      "FANS COFFE FRIENDS S.L.L",
      "Datos de la factura:",
      "Nº Factura: IGNIS 260266119 Tipo de factura:",
      "Fecha factura: 17 de agosto de 2026 Forma de pago: DOMICILIADO",
      "Resumen de la factura:",
      "Impuesto Aplicado 200,41 €",
      "Total Factura: 1.154,72 €",
      "Desglose factura:",
      "Base Imponible 954,31€ 21% sobre 954,31 € 200,41 €",
      "TOTAL FACTURA 1.154,72 €",
    ].join("\n"))

    expect(draft.series).toBe("")
    expect(draft.number).toBe("IGNIS 260266119")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "954.31", taxAmount: "200.41" }])

    const splitColumns = parseInvoiceText([
      "Datos de la factura:",
      "Fecha factura:",
      "Nº Factura:",
      "Tipo de factura:",
      "17 de agosto de 2026",
      "IGNIS 260266119",
      "Base Imponible",
      "954,31€",
      "21% sobre",
      "954,31 €",
      "200,41 €",
      "TOTAL FACTURA",
      "1.154,72 €",
    ].join("\n"))

    expect(splitColumns.number).toBe("IGNIS 260266119")
    expect(splitColumns.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "954.31", taxAmount: "200.41" }])
  })

  it("parses Vandemoortele NIF and invoice number without treating the product code as an IVA rate", () => {
    const draft = parseInvoiceText([
      "Factura 13386932",
      "NIF Cliente: ES B09711078",
      "Cód IVA %IVA Base Imp. Importe IVA Total Neto 92,11 EUR",
      "1E 10,00 % 92,11 EUR 9,21 EUR Total IVA 9,21 EUR",
      "Total Factura 101,32 EUR",
      "Fecha factura: 14/08/2026 Incoterms 2020: CPT MADRID",
      "Pos Artículo Descripción artículo Ctd UdV Pr. Br. Pr. Neto/ UdV Base Imp. Imp Total",
      "000010 53316 Rocky Road Cake 1 CAR 153,5200 92,1100 CAR 92,11 1E 101,32",
      "Nº NIF ESW0174826H",
    ].join("\n"))

    expect(draft.number).toBe("13386932")
    expect(draft.issuerTaxId).toBe("ESW0174826H")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "10.00", taxableBase: "92.11", taxAmount: "9.21" }])
    expect(draft.totalVat).toBe("9.21")

    expect(parseInvoiceText("NIF Cliente: ES B09711078\nNº NIF ES W0174826H").issuerTaxId).toBe("ESW0174826H")
  })

  it("parses the Asalma layout with separated invoice header values", () => {
    const draft = parseInvoiceText([
      "C/ Sebastián Herrera 12",
      "28012 Madrid",
      "FANS COFFE FRIEDS, S.L.L.",
      "B09711078",
      "C/ Doctor Esquerdo, 180 Local B",
      "Fecha FACTURA Hoja",
      "01/08/2026 AA/26/1262 1/1",
      "Descripción Cantidad Precio % Dcto Importe",
      "Servicios contables del mes de la fecha 1,00 200,00 200,00",
      "Servicios laborales 8,00 14,50 116,00",
      "Base Imponible % I.V.A. Importe",
      "316,00 21,00 66,36 382,36",
      "Total 382,36",
      "Forma de Pago Recibo bancario",
      "Vencimientos: 01/08/2026 382,36",
      "C/ Sebastian Herrera, 12-14 - 28012 Madrid - Teléf.: 91 522 15 33",
      "Inscrita en el Mº de Trabajo y S.Social, Dirección Prov. de Madrid con el nº 1.493 C.I.F G 78458809",
    ].join("\n"))

    expect(draft.series).toBe("AA/26")
    expect(draft.number).toBe("1262")
    expect(draft.issuerTaxId).toBe("G-78458809")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "316.00", taxAmount: "66.36" }])
    expect(invoiceDraftToAccounting(draft, "")).toMatchObject({ invoiceNumber: "AA/26/1262", taxId: "G-78458809", base21: "316.00", vat21: "66.36", totalBase: "316.00", totalVat: "66.36", invoiceTotal: "382.36" })
  })

  it("parses the Nicnat layout with invoice, date and tax values in separate rows", () => {
    const draft = parseInvoiceText([
      "FACTURA",
      "NICNAT GOURMET SL",
      "FANS COFFEE FRIENDS SLL",
      "CANOA 31 3C",
      "28042 MADRID",
      "DOCTOR ESQUERDO 180",
      "C.I.F. B86903721",
      "B09711078",
      "Nº Factura Fecha Fecha Valor Referencia",
      "A/2051 31/07/2026 31/07/2026",
      "Descripción",
      "Cantidad Código Artículo Precio IVA Subtotal",
      "2,00 38-3028 MATCHA EN POLVO 100% PURO FORMATO 250 GR O&O 44,75 10,00 89,50",
      "2,00 Subtotal 89,50",
      "Descuento Dto P.Pago IVA Base Imponible Importe IVA Importe R.E.",
      "% %",
      "10,00% 89,50 8,95",
      "TOTAL FACTURA",
      "98,45 €",
    ].join("\n"))

    expect(draft.series).toBe("A")
    expect(draft.number).toBe("2051")
    expect(draft.issueDate).toBe("2026-07-31")
    expect(draft.issuerTaxId).toBe("B-86903721")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "10.00", taxableBase: "89.50", taxAmount: "8.95" }])
    expect(invoiceDraftToAccounting(draft, "")).toMatchObject({ invoiceNumber: "A/2051", date: "2026-07-31", base10: "89.50", vat10: "8.95", totalBase: "89.50", totalVat: "8.95", invoiceTotal: "98.45" })

    const shortDate = parseInvoiceText("Nº Factura Fecha Fecha Valor Referencia\nA/2051 31/07/26 31/07/26")
    expect([shortDate.series, shortDate.number].filter(Boolean).join("/")).toBe("A/2051")
  })

  it("keeps Okin PDF text values and accepts the issuer identity from OCR supplement", () => {
    const draft = parseInvoiceText([
      "Cliente: 6095",
      "FANS COFFEE FRIENDS SLL",
      "B09711078",
      "FACTURA Nº FECHA",
      "14046 31-08-2026 1",
      "Base Imponible % IVA Cuota IVA Total Factura",
      "667,17 265,13 10,00% 26,51 709,76",
      "402,04 4,00% 16,08",
      "Giro vto 5 dias F/F",
      "DCA Okin S.L.",
      "B84151760",
    ].join("\n"))

    expect(draft.number).toBe("14046")
    expect(draft.issueDate).toBe("2026-08-31")
    expect(draft.issuerTaxId).toBe("B84151760")
    expect(draft.taxes).toEqual([
      { type: "IVA", percentage: "4.00", taxableBase: "402.04", taxAmount: "16.08" },
      { type: "IVA", percentage: "10.00", taxableBase: "265.13", taxAmount: "26.51" },
    ])
    expect(draft.totalAmount).toBe("709.76")
  })

  it("parses the Makro reverse-charge layout from the PDF text layer", () => {
    const draft = parseInvoiceText([
      "Factura",
      "Fans Coffee Friends S.l.l.,",
      "GTIN Descripción del Artículo Cant. Imp. Precio neto Total neto",
      "4894208347656 METRO Professional Exprimidor GJU2001 1 0% 220,00 € 220,00 €",
      "Total Neto: 220,00 €",
      "Total IVA 0%: 0,00 €",
      "Total Bruto: 220,00 €",
      "Operación sujeta a la inversión del sujeto pasivo.",
      "Fecha de Factura",
      "31.03.2026",
      "Número de Pedido",
      "O26-749563631502",
      "Número de Factura",
      "F26-03527339",
      "Fecha de Orden",
      "31.03.2026",
      "NIF",
      "B09711078",
      "CIF",
      "ESB09711078",
      "Método de pago: Tarjeta de Crédito",
      "Metro Markets GmbH | Schlüterstr. 5. | 40235 Düsseldorf | IVA ESN0022044B",
    ].join("\n"))

    expect(draft.number).toBe("F26-03527339")
    expect(draft.issueDate).toBe("2026-03-31")
    expect(draft.issuerTaxId).toBe("ESN0022044B")
    expect(draft.paymentMethod).toBe("Tarjeta")
    expect(draft.taxes).toEqual([{ type: "IVA", percentage: "0.00", taxableBase: "220.00", taxAmount: "0.00" }])
    expect(invoiceDraftToAccounting(draft, "")).toMatchObject({ invoiceNumber: "F26-03527339", exemptBase: "220.00", totalBase: "220.00", totalVat: "0.00", invoiceTotal: "220.00" })
  })

  it("parses the Makro delivery invoice with structured number and coded tax rates", () => {
    const draft = parseInvoiceText([
      "Makro Distribucion Mayorista, S.A.",
      "NIF: A-28/647451",
      "Factura 0/0(031)0053/(2026)036722 (053-240372) 031/400 2185",
      "Fecha de venta: 12/08/2026 04:16",
      "Fans Coffee Friends S.l.l. N.I.F.: B09711078",
      "Número de pedido 9-218753407",
      "Mercancía % IMP Total Imp.",
      "112,81 1=10,00% 11,28",
      "158,21 2=21,00% 33,22",
      "25,82 5= 4,00% 1,03",
      "296,84 45,53",
      "Total a pagar 342,37",
      "Pago en entrega 342,37",
    ].join("\n"))

    expect(draft.number).toBe("0/0(031)0053/(2026)036722")
    expect(draft.issueDate).toBe("2026-08-12")
    expect(draft.issuerTaxId).toBe("A-28647451")
    expect(draft.taxes).toEqual([
      { type: "IVA", percentage: "4.00", taxableBase: "25.82", taxAmount: "1.03" },
      { type: "IVA", percentage: "10.00", taxableBase: "112.81", taxAmount: "11.28" },
      { type: "IVA", percentage: "21.00", taxableBase: "158.21", taxAmount: "33.22" },
    ])
    expect(draft.totalAmount).toBe("342.37")
    expect(draft.paymentMethod).toBe("Pago en entrega")
  })
})
