import { describe, expect, it } from "vitest"
import { parseFacturaText } from "../factura-ocr"

describe("parseFacturaText", () => {
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

    const draft = parseFacturaText(text)

    expect(draft.serie).toBe("9960")
    expect(draft.numero).toBe("3776")
    expect(draft.fechaPago).toBe("2026-08-20")
    expect(draft.numeroPedido).toBe("7517")
    expect(draft.fechaPedido).toBe("2026-08-11")
    expect(draft.centroEntrega).toBe("Calle Doctor Esquerdo 180")
    expect(draft.nifEmisor).toBe("B80895410")
    expect(draft.lineas).toHaveLength(8)
    expect(draft.lineas[0]).toMatchObject({ referenciaProveedor: "380", cantidad: "6.00", precioUnitario: "13.50", totalLinea: "81.00" })
    expect(draft.totalNeto).toBe("188.70")
    expect(draft.totalDescuento).toBe("0.00")
    expect(draft.totalIva).toBe("18.87")
    expect(draft.importeTotal).toBe("207.57")
    expect(draft.impuestos).toEqual([
      { tipo: "IVA", porcentaje: "0.00", baseImponible: "0.00", cuota: "0.00" },
      { tipo: "IVA", porcentaje: "4.00", baseImponible: "0.00", cuota: "0.00" },
      { tipo: "IVA", porcentaje: "10.00", baseImponible: "188.70", cuota: "18.87" },
      { tipo: "IVA", porcentaje: "21.00", baseImponible: "0.00", cuota: "0.00" },
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

    const draft = parseFacturaText(text)

    expect(draft.serie).toBe("FAC-2026")
    expect(draft.numero).toBe("8740")
    expect(draft.fechaExpedicion).toBe("2026-08-11")
    expect(draft.fechaVencimiento).toBe("2026-08-11")
    expect(draft.nifEmisor).toBe("B09816158")
    expect(draft.razonSocialEmisor).toBe("LACTEOS GUERRERO SL")
    expect(draft.domicilioFiscalEmisor).toContain("CALLE LEON NO. 24")
    expect(draft.formaPago).toBe("Transferencia bancaria")
    expect(draft.referenciaAlbaran).toBe("ALB-2026/10248")
    expect(draft.fechaAlbaran).toBe("2026-08-10")
    expect(draft.lineas).toHaveLength(2)
    expect(draft.lineas[0]).toMatchObject({ referenciaProveedor: "512", cantidad: "4.00", formatoOriginal: "Caja 40", precioUnitario: "1.27", baseImponible: "203.20", tipoIva: "10.00", lote: "20260716", fechaVencimiento: "2026-10-16" })
    expect(draft.lineas[1]).toMatchObject({ referenciaProveedor: "664", cantidad: "1.00", formatoOriginal: "Caja 24", precioUnitario: "0.79", baseImponible: "18.96", tipoIva: "21.00", lote: "L6DF1078", fechaVencimiento: "2027-06-12" })
    expect(draft.totalNeto).toBe("222.16")
    expect(draft.totalIva).toBe("24.30")
    expect(draft.importeTotal).toBe("246.46")
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

    const draft = parseFacturaText(text)

    expect(draft.serie).toBe("ORD_031_2026")
    expect(draft.numero).toBe("0021751")
    expect(draft.nifEmisor).toBe("A-28812618")
    expect(draft.lineas).toHaveLength(5)
    expect(draft.lineas.map((linea) => linea.codigoArticulo)).toEqual(["17103", "12011", "22195", "22185", "18117"])
    expect(draft.lineas.map((linea) => linea.descripcion)).toEqual([
      "ROSENMANDEL cort opac 2u 135x300",
      "STRIMMIG plat postre 21 gres gri",
      "IKEA 365+ GUNSTIG salvamant&imán",
      "DRAGON N cuchar café 11 acero in",
      "GRILLTIDER brcha bbcoa silicona",
    ])
    expect(draft.lineas.map((linea) => linea.totalLinea)).toEqual(["29.99", "44.97", "6.99", "6.99", "0.99"])
    expect(draft.totalNeto).toBe("74.34")
    expect(draft.totalIva).toBe("15.59")
    expect(draft.importeTotal).toBe("89.93")
  })

  it("covers OCR fallback branches and alternate value layouts", () => {
    const draft = parseFacturaText([
      "CIF: A-99999999",
      "A09711078",
      "Forma de Pago:",
      "Contado",
      "Total Bruto:",
      "12,34",
    ].join("\n"))
    expect(draft.nifEmisor).toBe("A99999999")
    expect(draft.receptorCifValido).toBe(true)
    expect(draft.formaPago).toBe("Contado")
    expect(draft.importeTotal).toBe("12.34")

    expect(parseFacturaText("09711078").receptorCifValido).toBe(true)
    expect(parseFacturaText("A-28812618").receptorCifValido).toBe(false)
    expect(parseFacturaText("CIF: A-28812618").nifEmisor).toBe("A-28812618")
    expect(parseFacturaText("CIF-B09711078").nifEmisor).toBe("B09711078")

    const companyFallback = parseFacturaText("ACME S.L.\nCalle Mayor 1\n28007 Madrid")
    expect(companyFallback.razonSocialEmisor).toBe("ACME S.L.")
    expect(companyFallback.domicilioFiscalEmisor).toContain("Calle Mayor 1")

    const yolmarWithoutLot = parseFacturaText("123 Producto Kilo 2,00 0,00 3,00 10% 0,60 6,00\nCaducidad: 01/01/27")
    expect(yolmarWithoutLot.lineas[0]).toMatchObject({ referenciaProveedor: "123", lote: "", fechaVencimiento: "2027-01-01" })

    const generic = parseFacturaText("123 Producto de prueba 2,00 Caja 3,00 6,00 10%")
    expect(generic.lineas[0]).toMatchObject({ referenciaProveedor: "123", formatoOriginal: "123 Producto de prueba 2,00 Caja 3,00 6,00 10%", cantidad: "2.00", precioUnitario: "3.00", baseImponible: "6.00" })

    const cashFallback = parseFacturaText("Saldo: 12,34\nEfectivo 20,00")
    expect(cashFallback.importeTotal).toBe("12.34")

    const standaloneTotal = parseFacturaText("BASE IMPONIBLE TOTAL\n10% 1,00 0,10\n123,45")
    expect(standaloneTotal.importeTotal).toBe("123.45")

    const protectedText = parseFacturaText("BASE IMPONIBLE TOTAL\nProtección de datos personales\n123,45")
    expect(protectedText.importeTotal).toBe("0")

    const legacyNumberFallback = parseFacturaText("ABC-1-2/3")
    expect(legacyNumberFallback.serie).toBe("ABC-1-2")
    expect(legacyNumberFallback.numero).toBe("3")
  })
})
