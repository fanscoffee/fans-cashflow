import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { buildCapturedAccountingRows, buildAccountingRows, buildAccountingWorkbook } from "../accounting-export"

const invoice = {
  series: "",
  number: "F-100",
  issueDate: new Date("2026-07-15T00:00:00.000Z"),
  documentType: "COMPRA_MERCANCIA",
  workflowStatus: "CONFORMADA",
  paymentMethod: null,
  issuerLegalName: "Proveedor SA",
  issuerTaxId: "B12345678",
  netTotal: 100,
  totalVat: 21,
  withholdingTotal: 0,
  totalAmount: 121,
  supplier: { legalName: "Proveedor SA", taxId: "B12345678" },
  creditor: { name: "Proveedor SA", taxId: "B12345678", type: "PROVEEDOR_MERCANCIA" },
  taxes: [{ type: "IVA", percentage: 21, taxableBase: 100, taxAmount: 21 }],
  applications: [{ payment: { paymentMethod: { type: "TRANSFERENCIA" } } }],
}

describe("accounting-export", () => {
  it("maps invoices, expenses and legacy shift expenses to the accounting layout", () => {
    const rows = buildAccountingRows({
      invoices: [invoice],
      expenses: [{
        accrualDate: new Date("2026-07-16T00:00:00.000Z"),
        concept: "Luz",
        amount: 50,
        receipt: "RECIBO",
        category: { name: "Suministros" },
        creditor: { name: "Compañía", taxId: "A12345678", type: "SERVICIOS" },
        applications: [],
      }],
      expensesLegacy: [{ amount: 12.5, supplier: "Compra antigua", shift: { date: new Date("2026-07-17T00:00:00.000Z"), shift: "mañana" } }],
    })

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ number: 1, invoiceNumber: "F-100", base21: 100, vat21: 21, invoiceTotal: 121, paymentMethod: "BANCO" })
    expect(rows[1]).toMatchObject({ number: 2, concept: "SUMINISTROS", exemptBase: 50, invoiceTotal: 50 })
    expect(rows[2]).toMatchObject({ number: 3, concept: "GASTO TURNO LEGACY", exemptBase: 12.5, paymentMethod: "EFECTIVO" })
  })

  it("creates the expected worksheet, headers and totals", async () => {
    const rows = buildAccountingRows({ invoices: [invoice], expenses: [], expensesLegacy: [] })
    const buffer = await buildAccountingWorkbook(rows)
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

  it("maps standalone accounting captures to the same worksheet layout", () => {
    const rows = buildCapturedAccountingRows([{
      date: new Date("2026-07-15T00:00:00.000Z"),
      invoiceNumber: "CAP-1",
      supplierOrCreditor: "Proveedor independiente",
      taxId: "B12345678",
      concept: "SERVICIO",
      exemptBase: 0,
      base21: 100,
      vat21: 21,
      base10: 0,
      vat10: 0,
      base4: 0,
      vat4: 0,
      base2: 0,
      vat2: 0,
      totalBase: 100,
      totalVat: 21,
      withholdingTax: 0,
      invoiceTotal: 121,
      paymentMethod: "BANCO",
    }])
    expect(rows[0]).toMatchObject({ number: 1, invoiceNumber: "CAP-1", supplier: "Proveedor independiente", base21: 100, vat21: 21, invoiceTotal: 121 })
  })
})
