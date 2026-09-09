import { describe, expect, it } from "vitest"
import { parseInvoiceText } from "../invoice-ocr"
import { invoiceDraftToAccounting } from "../accounting-invoices"

function text(...lines: string[]) {
  return lines.join("\n")
}

const layouts = [
  {
    name: "Monbake multi-page summary",
    text: text(
      "FACTURA Teléfono: 631319665",
      "CLIENTE FECHA NUMERO HOJA",
      "MONBAKE GRUPO EMPRESARIAL S.A.U.",
      "184900 31.08.2026 2258135893 1",
      "NIF A31025778",
      "IMP. BRUTO DESCUENTO BASE IMPONIBLE % IVA % R.EQUIV",
      "35,10 R1 4,00 1,40 0,00 0,00 36,50",
      "512,65 R6 10,00 51,26 0,00 0,00 563,91",
      "FORMA DE PAGO TOTAL A PAGAR 600,41 EUR",
      "TRANSFERENCIA 5 DIAS",
    ),
    expected: { invoice: "2258135893", date: "2026-08-31", taxId: "A31025778", payment: "Transferencia bancaria", form: { base4: "35.10", vat4: "1.40", base10: "512.65", vat10: "51.26", totalBase: "547.75", totalVat: "52.66", invoiceTotal: "600.41" } },
  },
  {
    name: "Drinks Madrid tax table",
    text: text(
      "Drinks Madrid S.L.",
      "FACTURA : 2608A000729",
      "FECHA : 31/08/2026",
      "Nif. B58443821",
      "Forma de Pago",
      "GI A la Vista",
      "Vencimientos Base % Importe % Importe",
      "05/09/2026 364.69 22.18 21.00 4.66",
      "160.24 10.00 16.02",
      "155.38 4.00 6.22",
      "TOTALES 26.90",
      "TOTAL BRUTO TOTAL NETO TOTAL IVA + RE TOTAL",
      "337.79 337.79 26.90 EUR 364.69",
    ),
    expected: { invoice: "2608A000729", date: "2026-08-31", taxId: "B58443821", payment: "A la Vista", supplier: "Drinks Madrid S.L.", form: { base4: "155.38", vat4: "6.22", base10: "160.24", vat10: "16.02", base21: "22.18", vat21: "4.66", totalBase: "337.79", totalVat: "26.90", invoiceTotal: "364.69" } },
  },
  {
    name: "Rent with IRPF",
    text: text("Razón social: Regino Sanz de Frutos", "DNI: 51054893-E", "Factura Nº 2026-9", "Fecha emisión: 01-09-26", "B-09711078", "BASE IMPONIBLE 590,00", "- IRPF 19,00% - 112,10", "+ IVA 21,00% 123,90", "Total recibido 601,80"),
    expected: { invoice: "2026-9", date: "2026-09-01", taxId: "51054893-E", payment: "", form: { base21: "590.00", vat21: "123.90", totalBase: "590.00", totalVat: "123.90", withholdingTax: "112.10", invoiceTotal: "601.80" } },
  },
  {
    name: "Qualianza distribution",
    text: text("QUALIANZA S. INT DIST,SLU", "CIF:ESB09547167", "FACTURA", "Factura Nº Fecha Factura Forma de Pago", "2206878702 31.08.2026 Transferencia 07.09.2026", "B.Imponible % IVA Cuota IVA", "673,11 4,00 26,92", "306,85 10,00 30,69", "31,49 21,00 6,61", "Importe(sin I.V.A.) 1.011,45", "Importe I.V.A. 64,22", "IMPORTE TOTAL (EUR) 1.075,67"),
    expected: { invoice: "2206878702", date: "2026-08-31", taxId: "ESB09547167", payment: "Transferencia bancaria", form: { base4: "673.11", vat4: "26.92", base10: "306.85", vat10: "30.69", base21: "31.49", vat21: "6.61", totalBase: "1011.45", totalVat: "64.22", invoiceTotal: "1075.67" } },
  },
  {
    name: "Garcia de Pou",
    text: text("GARCIA DE POU, S.A.", "CIF . . . . . . . . : A17060864", "FACTURA", "Nº. F02034965 FECHA : 24/08/2026", "Anticipo de fondos", "PARCIAL NETO 430,82", "B.IMP. I.V.A. / I.G.I.C.", "430,82 21,00 % 90,47", "TOTAL FACTURA", "Euro 521,29"),
    expected: { invoice: "F02034965", date: "2026-08-24", taxId: "A-17060864", payment: "Anticipo de fondos", form: { base21: "430.82", vat21: "90.47", totalBase: "430.82", totalVat: "90.47", invoiceTotal: "521.29" } },
  },
  {
    name: "Grupo Traza service",
    text: text("FACTURA", "F2603711", "Fecha: 15/06/2026", "GRUPO TRAZA SERVICIOS INTEGRALES SOCIEDAD LIMITADA B73352270", "CONCEPTO PRECIO UNIDADES SUBTOTAL IVA TOTAL", "00001 101,65€ 1 101,65€ 21% 123,00€", "BASE IMPONIBLE IMPUESTO TOTAL IMPUESTO TOTAL", "101,65€ IVA 21% 21,35€ 123,00€", "Pagar por transferencia bancaria"),
    expected: { invoice: "F2603711", date: "2026-06-15", taxId: "B73352270", payment: "Transferencia bancaria", form: { base21: "101.65", vat21: "21.35", totalBase: "101.65", totalVat: "21.35", invoiceTotal: "123.00" } },
  },
  {
    name: "Asalma accounting",
    text: text("C/ Sebastián Herrera 12", "Fecha FACTURA Hoja", "01/08/2026 AA/26/1262 1/1", "FANS COFFE FRIEDS, S.L.L.", "B09711078", "Base Imponible % I.V.A. Importe", "316,00 21,00 66,36 382,36", "Total 382,36", "Forma de Pago Recibo bancario", "C.I.F G 78458809"),
    expected: { invoice: "AA/26/1262", date: "2026-08-01", taxId: "G-78458809", payment: "Recibo bancario", form: { base21: "316.00", vat21: "66.36", totalBase: "316.00", totalVat: "66.36", invoiceTotal: "382.36" } },
  },
  {
    name: "Panatticus weekly invoice",
    text: text("PANATTICUS S.L.", "B-87549150", "Número de Factura: 1424", "Fecha de Factura: 09/10/2023", "Productos Producto servido Devolución A Cobrar Tipo IVA Precio TOTAL", "PAN 24 3 21 4% 1,65 34,65", "BARRAS 525 13 512 4% 0,90 460,80", "RICHES 54 19 35 4% 0,60 21,00", "MODROÑO 22 5 17 4% 0,97 16,49", "PUNTOS 98 18 80 4% 0,70 56,00", "SUBTOTAL 588,94", "IVA 0,00", "TOTAL 588,94"),
    expected: { invoice: "1424", date: "2023-10-09", taxId: "B-87549150", payment: "", form: { base4: "588.94", vat4: "0.00", totalBase: "588.94", totalVat: "0.00", invoiceTotal: "588.94" } },
  },
  {
    name: "Nicnat product invoice",
    text: text("FACTURA", "NICNAT GOURMET SL", "C.I.F. B86903721", "Nº Factura Fecha", "A/2051 31/07/2026", "Subtotal 89,50", "Base Imponible % IVA Importe IVA", "10,00% 89,50 8,95", "TOTAL FACTURA", "98,45 €"),
    expected: { invoice: "A/2051", date: "2026-07-31", taxId: "B-86903721", payment: "", form: { base10: "89.50", vat10: "8.95", totalBase: "89.50", totalVat: "8.95", invoiceTotal: "98.45" } },
  },
  {
    name: "Andres Coral service",
    text: text("FACTURA", "1829", "FECHA Nº DE CLIENTE FACTURA", "12/08/2026 00145 1829", "CLIENTE: Fans Coffee Friends S.L.L B09711078", "ACS ANDRÉS CORAL ZAMBRANO X-3474832-S", "BASE 126,00", "IVA 21% 26,46", "TOTAL 152,46", "Forma de pago: TRANSFERENCIA"),
    expected: { invoice: "1829", date: "2026-08-12", taxId: "X-3474832-S", payment: "Transferencia bancaria", form: { base21: "126.00", vat21: "26.46", totalBase: "126.00", totalVat: "26.46", invoiceTotal: "152.46" } },
  },
  {
    name: "Yolmar ABCSystems",
    text: text("HIJOS DE GONZALEZ Y CORREA SL", "B80895410", "Fecha de Factura: 31/07/2026", "CIF/NIF: B09711078", "Número de Factura: 9960/3665", "Forma de Pago Contado/Efectivo", "Total Neto: 244,20", "Reducido: 244,20 10% 24,42", "Total Bruto: 268,62"),
    expected: { invoice: "9960/3665", date: "2026-07-31", taxId: "B80895410", payment: "Efectivo", form: { base10: "244.20", vat10: "24.42", totalBase: "244.20", totalVat: "24.42", invoiceTotal: "268.62" } },
  },
  {
    name: "Princesitas Factory",
    text: text("PRINCESITAS FACTORY, S.L.", "B88460738", "Documento Número Página Fecha", "Factura 000484 1 03/08/2026", "N.I.F. B09711078", "RECIBO BANCO", "TIPO IMPORTE DESCUENTO PRONTO PAGO PORTES FINANCIACIÓN BASE I.V.A. R.E.", "10 111,72 111,72 11,18", "OBSERVACIONES: TOTAL: 122,90", "Vencimientos Importe Domiciliación", "03/08/2026 122,90"),
    expected: { invoice: "000484", date: "2026-08-03", taxId: "B88460738", payment: "Recibo bancario", form: { base10: "111.72", vat10: "11.18", totalBase: "111.72", totalVat: "11.18", invoiceTotal: "122.90" } },
  },
  {
    name: "Ignis electricity",
    text: text("Loop Electricidad y Gas, S.L. CIF B87095543", "FANS COFFE FRIENDS S.L.L. B09711078", "Nº Factura: IGNIS 260266119", "Fecha factura: 17 de agosto de 2026", "Forma de pago: DOMICILIADO", "Base Imponible 954,31€ 21% sobre 954,31 € 200,41 €", "TOTAL FACTURA 1.154,72 €"),
    expected: { invoice: "IGNIS 260266119", date: "2026-08-17", taxId: "B-87095543", payment: "DOMICILIACION", concept: "GASTO", form: { base21: "954.31", vat21: "200.41", totalBase: "954.31", totalVat: "200.41", invoiceTotal: "1154.72" } },
  },
  {
    name: "Cafes Candelas",
    text: text("Cafés Candelas, SLU", "CIF: B27013713", "Nº Factura: 2401332685", "Fecha 31.08.2026", "Bruto Descuento Punto Verde Imp.Plas. Base IVA % IVA Cuota IVA % REC Cuota REC Total Factura", "1,251.55 0.00 3.42 0.00 1,158.27 10.00 % 115.83", "96.70 21.00 % 20.31 1,391.11", "Via de Pago: Domiciliación Bancaria SEPA"),
    expected: { invoice: "2401332685", date: "2026-08-31", taxId: "B-27013713", payment: "DOMICILIACION", form: { base10: "1158.27", vat10: "115.83", base21: "96.70", vat21: "20.31", totalBase: "1254.97", totalVat: "136.14", invoiceTotal: "1391.11" } },
  },
  {
    name: "Global Preventium",
    text: text("FACTURA", "Factura: O02086/23", "Fecha: 10/10/2023", "CIF: B09711078", "Exento Sujeto I.V.A. I.V.A.21% Total", "5 VIGILANCIA COLECTIVA 50,00 0,00 10,50 60,50", "Exento de IVA: 0,00", "Sujeto a IVA: 50,00", "I.V.A. 10,50", "Total Factura: 60,50", "Forma de Pago: Recibo bancario", "RESPONSABLE: GLOBAL PREVENTIUM,S.L. CIF: B13448154"),
    expected: { invoice: "O02086/23", date: "2023-10-10", taxId: "B-13448154", payment: "Recibo bancario", form: { base21: "50.00", vat21: "10.50", totalBase: "50.00", totalVat: "10.50", invoiceTotal: "60.50" } },
  },
  {
    name: "Vandemoortele",
    text: text("Factura 13386932", "Vandemoortele Europe NV, Sucursal en España", "Nº NIF ESW0174826H", "Fecha factura: 14/08/2026", "Forma de pago: 8 días", "Cód IVA %IVA Base Imp. Importe IVA", "1E 10,00 % 92,11 EUR 9,21 EUR", "Total Factura 101,32 EUR"),
    expected: { invoice: "13386932", date: "2026-08-14", taxId: "ESW0174826H", payment: "8 días", form: { base10: "92.11", vat10: "9.21", totalBase: "92.11", totalVat: "9.21", invoiceTotal: "101.32" } },
  },
  {
    name: "Lacteos Guerrero",
    text: text("FACTURA FAC-2026 / 8143", "LACTEOS GUERRERO SL", "NIF: B09816158", "FECHA DE EMISIÓN 28/07/2026", "IVA 10,00 % 185,48 € 18,55 €", "IVA 21,00 % 37,92 € 7,96 €", "223,40 €", "249,91 €", "PARA TRANSFERENCIA BANCARIA"),
    expected: { invoice: "FAC-2026/8143", date: "2026-07-28", taxId: "B09816158", payment: "Transferencia bancaria", supplier: "LACTEOS GUERRERO SL", form: { base10: "185.48", vat10: "18.55", base21: "37.92", vat21: "7.96", totalBase: "223.40", totalVat: "26.51", invoiceTotal: "249.91" } },
  },
  {
    name: "ILA bakery delivery",
    text: text("FACTURA Nº FECHA", "14046 31-08-2026 1", "B09711078", "Base Imponible % IVA Cuota IVA Total Factura", "667,17 265,13 10,00% 26,51 709,76", "402,04 4,00% 16,08", "Giro vto 5 dias F/F"),
    expected: { invoice: "14046", date: "2026-08-31", taxId: "", payment: "Giro", form: { base4: "402.04", vat4: "16.08", base10: "265.13", vat10: "26.51", totalBase: "667.17", totalVat: "42.59", invoiceTotal: "709.76" } },
  },
  {
    name: "Makro reverse charge",
    text: text("Metro Markets GmbH | Schlüterstr. 5. | 40235 Düsseldorf", "Número de Pedido Número de Factura Fecha de Orden Número de Cliente", "O26-749563631502 F26-03527339 31.03.2026 80277104499", "NIF B09711078", "Total Neto: 220,00 €", "Total IVA 0%: 0,00 €", "Total Bruto: 220,00 €", "Método de pago: Tarjeta de Crédito", "IVA ESN0022044B"),
    expected: { invoice: "F26-03527339", date: "2026-03-31", taxId: "ESN0022044B", payment: "Tarjeta", form: { exemptBase: "220.00", totalBase: "220.00", totalVat: "0.00", invoiceTotal: "220.00" } },
  },
  {
    name: "Besfood juice invoice",
    text: text("INNDESA GESTION, S.L.", "IVA: B02677904", "Factura INV/2026/1268", "Fecha factura: 03/08/2026", "Términos: Pago_anticipado", "Subtotal 158,40 €", "IVA 21% en 0,00 € 0,00 €", "IVA 4% en 158,40 € 6,34 €", "Total 164,74 €"),
    expected: { invoice: "INV/2026/1268", date: "2026-08-03", taxId: "B02677904", payment: "Pago anticipado", form: { base4: "158.40", vat4: "6.34", totalBase: "158.40", totalVat: "6.34", invoiceTotal: "164.74" } },
  },
  {
    name: "O2 telecommunications",
    text: text("07 de Agosto de 2026", "Factura núm: OM7VAHJ0019623", "Titular: FANS COFEE FRIENDS SLL B09711078", "Base imponible 41,32 €", "IVA (21.00 %) sobre 41,32 € 8,68 €", "Total factura 50,00 €", "Mandaremos el recibo a tu cuenta de BANCO SANTANDER" , "CIF A-82018474"),
    expected: { invoice: "OM7VAHJ0019623", date: "2026-08-07", taxId: "A-82018474", payment: "DOMICILIACION", form: { base21: "41.32", vat21: "8.68", totalBase: "41.32", totalVat: "8.68", invoiceTotal: "50.00" } },
  },
  {
    name: "Sklum furniture",
    text: text("Sklum Home and Deco, SLU", "CIF B98845936", "FACTURA", "Núm: F11-376687", "Fecha: 31 de Agosto de 2026", "Total Bruto Base Imponible IVA TOT. FACTURA", "141,24 141,24 21% 29,65 170,89 EUR", "Forma de Pago / Domiciliación", "STRIPE"),
    expected: { invoice: "F11-376687", date: "2026-08-31", taxId: "B-98845936", payment: "STRIPE", form: { base21: "141.24", vat21: "29.65", totalBase: "141.24", totalVat: "29.65", invoiceTotal: "170.89" } },
  },
  {
    name: "Las Ballinas rent",
    text: text("SOCIEDAD INMOBILIARIA LAS BALLINAS S.L.", "NIF: B79117073", "SERIE Nº FACTURA FECHA EXPEDICION", "1094 01/09/2026 591 B09711078", "ARRENDAMIENTO CON IVA 2.680,00", "SUMINISTRO CON IVA 112,69", "SUPLIDOS B. EXENTA B. IMPONIBLE % IVA CUOTA IVA TOTAL FACTURA", "2.792,69 21,00 586,46 3.379,15", "FORMA DE PAGO VENCIMIENTO DOMICILIACIÓN", "TRANSFERENCIA"),
    expected: { invoice: "1094", date: "2026-09-01", taxId: "B79117073", payment: "Transferencia bancaria", form: { base21: "2792.69", vat21: "586.46", totalBase: "2792.69", totalVat: "586.46", invoiceTotal: "3379.15" } },
  },
  {
    name: "Loyverse SaaS",
    text: text("Loyverse Commerce Ltd.", "VAT Reg # : EU372052318", "Invoice # — 442452", "Invoice Date — Aug 08, 2026", "Invoice Amount — 6,05 €", "Total excl. VAT 5,00 €", "VAT @ 21% 1,05 €", "Total 6,05 €", "was paid by Visa card"),
    expected: { invoice: "442452", date: "2026-08-08", taxId: "EU372052318", payment: "Tarjeta", form: { base21: "5.00", vat21: "1.05", totalBase: "5.00", totalVat: "1.05", invoiceTotal: "6.05" } },
  },
  {
    name: "Ardelac sales report",
    text: text("FACTURA FANS COFFEE FRIENDS, S.L.L.", "Número: RV/26/1000578", "Fecha: 31/08/2026", "Subtotales Dto./Qto. Bases %IVA Impte.IVA", "23,80 23,80 21,00 5,00", "127,68 127,68 10,00 12,77", "157,74 157,74 4,00 6,31", "Total Documento 333,30", "Forma de pago: TRANSFERENCIA"),
    expected: { invoice: "RV/26/1000578", date: "2026-08-31", taxId: "", payment: "Transferencia bancaria", form: { base4: "157.74", vat4: "6.31", base10: "127.68", vat10: "12.77", base21: "23.80", vat21: "5.00", totalBase: "309.22", totalVat: "24.08", invoiceTotal: "333.30" } },
  },
  {
    name: "Amazon image invoice",
    text: text("Factura", "Pagado", "Vendido por FormyCake S.L.", "IVA ESB98481997", "Fecha de la factura/Fecha de la entrega 03 julio 2026", "Número de la factura ES60024ACGAQFI", "Total pendiente 29,11 €", "NIF sujeto de IVA B09711078", "IVA % Precio total (IVA excluido) IVA", "21% 24,06 € 5,05 €", "Total 29,11 €"),
    expected: { invoice: "ES60024ACGAQFI", date: "2026-07-03", taxId: "ESB98481997", payment: "", form: { base21: "24.06", vat21: "5.05", totalBase: "24.06", totalVat: "5.05", invoiceTotal: "29.11" } },
  },
] as const

describe("parseInvoiceText real invoice layouts", () => {
  it.each(layouts)("parses $name", ({ text: source, expected }) => {
    const draft = parseInvoiceText(source)
    const form = invoiceDraftToAccounting(draft, source)

    expect([draft.series, draft.number].filter(Boolean).join("/")).toBe(expected.invoice)
    expect(draft.issueDate).toBe(expected.date)
    expect(draft.issuerTaxId).toBe(expected.taxId)
    expect(draft.paymentMethod).toBe(expected.payment)
    if ("concept" in expected) expect(form.concept).toBe(expected.concept)
    if ("supplier" in expected) expect(form.supplierOrCreditor).toBe(expected.supplier)
    expect(form).toMatchObject(expected.form)
  })

  it("parses tabular PDFs when labels and values are emitted on separate rows", () => {
    const lasBallinas = parseInvoiceText(text(
      "SOCIEDAD INMOBILIARIA LAS BALLINAS S.L.",
      "NIF: B79117073",
      "SUPLIDOS B. EXENTA B. IMPONIBLE CUOTA IVA TOTAL FACTURA",
      "3.379,15",
      "1094 01/09/2026 591 B09711078",
      "SERIE FECHA OPERACION CÓDIGO CLIENTE NIF",
      "591",
      "Nº FACTURA",
      "FECHA EXPEDICION",
      "01/09/2026",
      "% IVA",
      "2.792,69 21,00 586,46",
    ))
    expect(lasBallinas.number).toBe("1094")
    expect(lasBallinas.issuerLegalName).toBe("SOCIEDAD INMOBILIARIA LAS BALLINAS S.L.")
    expect(lasBallinas.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "2792.69", taxAmount: "586.46" }])

    const drinks = parseInvoiceText(text(
      "Drinks Madrid S.L.",
      "FACTURA :",
      "FECHA :",
      "Nif. B58443821",
      "Forma de Pago",
      "GI A la Vista",
      "596755",
      "2608A000729",
      "31/08/2026",
    ))
    expect(drinks.number).toBe("2608A000729")
    expect(drinks.issueDate).toBe("2026-08-31")
    expect(drinks.issuerLegalName).toBe("Drinks Madrid S.L.")

    const qualianza = parseInvoiceText(text(
      "QUALIANZA S. INT DIST,SLU",
      "CIF:ESB09547167",
      "FACTURA",
      "Factura Nº",
      "2206878702 31.08.2026 Transferencia 07.09.2026",
      "B.Imponible % IVA Cuota IVA",
      "673,11 4,00 26,92",
      "306,85 10,00 30,69",
      "31,49 21,00 6,61",
    ))
    expect(qualianza.number).toBe("2206878702")
    expect(qualianza.taxes).toEqual([
      { type: "IVA", percentage: "4.00", taxableBase: "673.11", taxAmount: "26.92" },
      { type: "IVA", percentage: "10.00", taxableBase: "306.85", taxAmount: "30.69" },
      { type: "IVA", percentage: "21.00", taxableBase: "31.49", taxAmount: "6.61" },
    ])

    const garcia = parseInvoiceText(text(
      "GARCIA DE POU, S.A.",
      "CIF . . . . . . . . : A17060864",
      "FACTURA",
      "Nº. F02034965 FECHA : 24/08/2026",
      "SUBTOTAL DESCUENTO TOTAL P.P. PORTES B.IMP. I.V.A. / I.G.I.C. REC.EQUIVALENCIA TOTAL FACTURA",
      "430,82 430,82 21,00 % 90,47 Euro 521,29",
    ))
    expect(garcia.number).toBe("F02034965")
    expect(garcia.taxes).toEqual([{ type: "IVA", percentage: "21.00", taxableBase: "430.82", taxAmount: "90.47" }])
  })

  it("parses Grupo Traza when the invoice total only appears in the summary columns", () => {
    const draft = parseInvoiceText(text(
      "FACTURA",
      "F2603711",
      "Fecha: 15/06/2026 FANS COFFEE FRIENDS, S.L.L.",
      "Fecha vencimiento: 15/06/2026 B09711078",
      "CALLE DOCTOR ESQUERDO, 180 - LOC B",
      "CONCEPTO PRECIO UNIDADES SUBTOTAL IVA TOTAL",
      "00001 101,65€ 1 101,65€ 21% 123,00€",
      "CONTRATO SANITARIO",
      "BASE IMPONIBLE IMPUESTO TOTAL IMPUESTO TOTAL",
      "101,65€ IVA 21% 21,35€ 123,00€",
      "101,65€ 123,00€",
      "Pagar por transferencia bancaria al siguiente número de cuenta",
    ))
    const form = invoiceDraftToAccounting(draft, "")
    expect(form).toMatchObject({ date: "2026-06-15", invoiceNumber: "F2603711", totalBase: "101.65", totalVat: "21.35", invoiceTotal: "123.00" })
  })

  it("parses Qualianza tax rows emitted before their table header", () => {
    const draft = parseInvoiceText(text(
      "QUALIANZA S. INT DIST,SLU",
      "CIF:ESB09547167",
      "Factura Nº",
      "2206878702",
      "Fecha Factura",
      "31.08.2026",
      "673,11 4,00 26,92",
      "306,85 10,00 30,69 Importe I.V.A. 64,22",
      "31,49 21,00 6,61",
      "B.Imponible % IVA % RE Cuota IVA Cuota R.E.",
      "1.011,45 TOTALES 64,22",
      "Importe(sin I.V.A.) 1.011,45",
      "Importe I.V.A. 64,22",
      "IMPORTE TOTAL (EUR) 1.075,67",
    ))
    const form = invoiceDraftToAccounting(draft, "")
    expect(form).toMatchObject({ invoiceNumber: "2206878702", base4: "673.11", vat4: "26.92", base10: "306.85", vat10: "30.69", base21: "31.49", vat21: "6.61" })
  })

  it("parses Princesitas when the document values are separated from their headers", () => {
    const draft = parseInvoiceText(text(
      "Documento Número Página Fecha",
      "N.I.F. AGENTE",
      "ARTÍCULO DESCRIPCIÓN CANTIDAD PRECIO UD. SUBTOTAL DTO. TOTAL",
      "TIPO IMPORTE DESCUENTO PRONTO PAGO PORTES FINANCIACIÓN BASE I.V.A. R.E.",
      "OBSERVACIONES: TOTAL:",
      "Vencimientos Importe Domiciliación Número de cuenta",
      "Factura",
      "Oficina",
      "FORMA DE PAGO",
      "PRINCESITAS FACTORY, S.L.",
      "B88460738",
      "16",
      "B09711078",
      "FANS COFFEE FRIENDS, S.L.L.",
      "000484 1 03/08/2026",
      "RECIBO BANCO",
      "10 111,72 111,72 11,18",
      "03/08/2026 122,90",
    ))
    const form = invoiceDraftToAccounting(draft, "")
    expect(form).toMatchObject({ date: "2026-08-03", invoiceNumber: "000484", base10: "111.72", vat10: "11.18" })
  })

  it("parses Candelas when invoice and date values are emitted below their labels", () => {
    const draft = parseInvoiceText(text(
      "RSI: 40.26315/LU",
      "FANS COFFEE FRIENDS SLL",
      "CIF: B09711078",
      "Cliente:",
      "Nº Factura:",
      "Fecha",
      "Oficina de Ventas",
      "Vendedor:",
      "227195",
      "2401332685",
      "31.08.2026",
      "2000 Centro",
      "143 - LUIS ALBERTO HERNANDEZ",
      "Cafés Candelas, SLU",
      "CIF: B27013713",
      "Bruto Descuento Punto Verde Imp.Plas. Base IVA % IVA Cuota IVA % REC Cuota REC Total Factura",
      "1,251.55 0.00 3.42 0.00 1,158.27 10.00 % 115.83",
      "96.70 21.00 % 20.31 1,391.11",
    ))
    const form = invoiceDraftToAccounting(draft, "")
    expect(form).toMatchObject({ date: "2026-08-31", invoiceNumber: "2401332685", base10: "1158.27", vat10: "115.83", base21: "96.70", vat21: "20.31", totalBase: "1254.97", totalVat: "136.14", invoiceTotal: "1391.11" })
  })

  it("does not treat the next-page invoice number as a 2% tax row", () => {
    const berlys = parseInvoiceText(text(
      "NIF B09711078",
      "FACTURA Teléfono: 631319665",
      "CLIENTE FECHA NUMERO HOJA",
      "MONBAKE GRUPO EMPRESARIAL S.A.U.",
      "184900 31.08.2026 2258135893 1",
      "NIF A31025778",
      "IMP. BRUTO DESCUENTO",
      "BASE IMPONIBLE % IVA % R.EQUIV",
      "FORMA DE PAGO TOTAL A PAGAR",
      "NIF B09711078",
      "FACTURA Teléfono: 631319665",
      "CLIENTE FECHA NUMERO HOJA",
      "MONBAKE GRUPO EMPRESARIAL S.A.U.",
      "184900 31.08.2026 2258135893 2",
      "NIF A31025778",
      "** Nuestros datos bancarios: IBAN: ES83 0075 8582 3506 0008 6764 -- B.SANTANDER **",
      "IMP. BRUTO DESCUENTO",
      "547,75 547,75",
      "BASE IMPONIBLE % IVA % R.EQUIV",
      "35,10 R1 4,00 1,40 0,00 0,00 36,50",
      "512,65 R6 10,00 51,26 0,00 0,00 563,91",
      "FORMA DE PAGO Vencimiento: 05.09.2026 TOTAL A 600,41 EUR",
      "TRANSFERENCIA 5 DIAS PAGAR",
    ))

    expect(berlys.taxes).toEqual([
      { type: "IVA", percentage: "4.00", taxableBase: "35.10", taxAmount: "1.40" },
      { type: "IVA", percentage: "10.00", taxableBase: "512.65", taxAmount: "51.26" },
    ])
    expect(invoiceDraftToAccounting(berlys, "")).toMatchObject({ base2: "0.00", totalBase: "547.75", totalVat: "52.66", invoiceTotal: "600.41" })
  })

  it("does not sum Mercadona product rows into the final tax summary", () => {
    const mercadona = parseInvoiceText(text(
      "Descripción Unid. P.Unitario B.Imp. IVA Cuota IVA Importe",
      "PREPARACIÓN 1 7,6400 7,6400 (*) 0,5600 8,2000",
      "Preparado para 5 0,9091 4,5455 10% 0,4545 5,0000",
      "Huevos 12 5,3846 64,6154 4% 2,5846 67,2000",
      "Bayeta pequeña 1 1,2397 1,2397 21% 0,2603 1,5000",
      "DETALLE (€)",
      "IVA Base Imponible Cuota Total",
      "4% 2.408,50 96,36 2.504,86",
      "10% 2.197,00 219,70 2.416,70",
      "21% 70,45 14,80 85,25",
      "Total Factura 5.006,81€",
    ))

    expect(mercadona.taxes).toEqual([
      { type: "IVA", percentage: "4.00", taxableBase: "2408.50", taxAmount: "96.36" },
      { type: "IVA", percentage: "10.00", taxableBase: "2197.00", taxAmount: "219.70" },
      { type: "IVA", percentage: "21.00", taxableBase: "70.45", taxAmount: "14.80" },
    ])
    expect(invoiceDraftToAccounting(mercadona, "")).toMatchObject({ totalBase: "4675.95", totalVat: "330.86", invoiceTotal: "5006.81" })
  })
})
