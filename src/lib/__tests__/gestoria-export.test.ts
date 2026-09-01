import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { buildCapturedGestoriaRows, buildGestoriaRows, buildGestoriaWorkbook } from "../gestoria-export"

const invoice = {
  serie: "",
  numero: "F-100",
  fechaExpedicion: new Date("2026-07-15T00:00:00.000Z"),
  tipoDocumento: "COMPRA_MERCANCIA",
  estadoCircuito: "CONFORMADA",
  formaPago: null,
  razonSocialEmisor: "Proveedor SA",
  nifEmisor: "B12345678",
  totalNeto: 100,
  totalIva: 21,
  totalRetenciones: 0,
  importeTotal: 121,
  proveedor: { razonSocial: "Proveedor SA", cifNif: "B12345678" },
  acreedor: { nombre: "Proveedor SA", nif: "B12345678", tipo: "PROVEEDOR_MERCANCIA" },
  impuestos: [{ tipo: "IVA", porcentaje: 21, baseImponible: 100, cuota: 21 }],
  aplicaciones: [{ pago: { medioPago: { tipo: "TRANSFERENCIA" } } }],
}

describe("gestoria-export", () => {
  it("maps invoices, expenses and legacy shift expenses to the gestoría layout", () => {
    const rows = buildGestoriaRows({
      facturas: [invoice],
      gastos: [{
        fechaDevengo: new Date("2026-07-16T00:00:00.000Z"),
        concepto: "Luz",
        importe: 50,
        justificante: "RECIBO",
        categoria: { nombre: "Suministros" },
        acreedor: { nombre: "Compañía", nif: "A12345678", tipo: "SERVICIOS" },
        aplicaciones: [],
      }],
      gastosLegacy: [{ importe: 12.5, proveedor: "Compra antigua", shift: { date: new Date("2026-07-17T00:00:00.000Z"), turno: "mañana" } }],
    })

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ numero: 1, facturaNumero: "F-100", base21: 100, iva21: 21, totalFactura: 121, formaPago: "BANCO" })
    expect(rows[1]).toMatchObject({ numero: 2, concepto: "SUMINISTROS", baseExenta: 50, totalFactura: 50 })
    expect(rows[2]).toMatchObject({ numero: 3, concepto: "GASTO TURNO LEGACY", baseExenta: 12.5, formaPago: "EFECTIVO" })
  })

  it("creates the expected worksheet, headers and totals", async () => {
    const rows = buildGestoriaRows({ facturas: [invoice], gastos: [], gastosLegacy: [] })
    const buffer = await buildGestoriaWorkbook(rows)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.getWorksheet("Gastos y Compras Fans")
    expect(sheet).toBeDefined()
    if (!sheet) throw new Error("No se generó la hoja de gestoría")
    const headerValues = sheet.getRow(1).values as ExcelJS.CellValue[]
    expect(headerValues.slice(1)).toEqual([
      "Nº", "Fecha", "Factura Nº", "Proveedor / Acreedor", "NIF", "Concepto",
      "BASE EXENTA", "Base Imponible 21%", "21% IVA", "Base Imponible 10%", "10% IVA",
      "Base Imponible 4%", "4% IVA", "Base Imponible 2%", "2% IVA", "TOTAL BASE IMPONIBLE",
      "TOTAL CUOTA IVA", "IRPF", "TOTAL FACTURA", "FORMA PAGO",
    ])
    expect(sheet.getRow(3).getCell(1).value).toBe("TOTAL")
    expect(sheet.getRow(3).getCell(8).value).toBe(100)
    expect(sheet.getRow(3).getCell(19).value).toBe(121)
  })

  it("maps standalone gestoría captures to the same worksheet layout", () => {
    const rows = buildCapturedGestoriaRows([{
      fecha: new Date("2026-07-15T00:00:00.000Z"),
      facturaNumero: "CAP-1",
      proveedorAcreedor: "Proveedor independiente",
      nif: "B12345678",
      concepto: "SERVICIO",
      baseExenta: 0,
      base21: 100,
      iva21: 21,
      base10: 0,
      iva10: 0,
      base4: 0,
      iva4: 0,
      base2: 0,
      iva2: 0,
      totalBase: 100,
      totalIva: 21,
      irpf: 0,
      totalFactura: 121,
      formaPago: "BANCO",
    }])
    expect(rows[0]).toMatchObject({ numero: 1, facturaNumero: "CAP-1", proveedor: "Proveedor independiente", base21: 100, iva21: 21, totalFactura: 121 })
  })
})
