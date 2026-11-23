import { describe, expect, it } from "vitest"
import { unzipSync, strFromU8 } from "fflate"
import { readSheet } from "read-excel-file/node"
import { buildCapturedAccountingRows, buildAccountingRows, buildAccountingWorkbook } from "../accounting-export"

const invoice = {
  series: "",
  number: "F-100",
  issueDate: new Date("2026-07-15T00:00:00.000Z"),
  documentType: "COMPRA_MERCANCIA",
  workflowStatus: "CONFORMADA",
  paymentMethod: null,
  entity: "BAKERY",
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
    expect(rows[0]).toMatchObject({ number: 1, invoiceNumber: "F-100", base21: 100, vat21: 21, invoiceTotal: 121, paymentMethod: "BANCO", origin: "FACTURA OPERATIVA" })
    expect(rows[1]).toMatchObject({ number: 2, concept: "SUMINISTROS", exemptBase: 50, invoiceTotal: 50 })
    expect(rows[2]).toMatchObject({ number: 3, concept: "GASTO TURNO LEGACY", exemptBase: 12.5, paymentMethod: "EFECTIVO" })
  })

  it("creates the expected worksheet, headers and totals", async () => {
    const rows = buildAccountingRows({ invoices: [invoice], expenses: [], expensesLegacy: [] })
    rows[0].invoiceNumber = "000123"
    rows[0].supplier = "A&B <Proveedor>"
    rows[0].concept = "=1+1"
    const buffer = await buildAccountingWorkbook([...rows, { ...rows[0], number: 2, voided: true }])
    const [header, first, , totals] = await readSheet(buffer, "Gastos y Compras Fans")

    expect(header).toEqual([
      "Nº", "Fecha", "Factura Nº", "Proveedor / Acreedor", "NIF", "ENTIDAD", "Concepto",
      "BASE EXENTA", "Base Imponible 21%", "21% IVA", "Base Imponible 10%", "10% IVA",
      "Base Imponible 4%", "4% IVA", "Base Imponible 2%", "2% IVA", "TOTAL BASE IMPONIBLE",
      "TOTAL CUOTA IVA", "IRPF", "TOTAL FACTURA", "FORMA PAGO", "ORIGEN",
    ])
    expect(first.slice(0, 7)).toEqual([1, invoice.issueDate, "000123", "A&B <Proveedor>", "B12345678", "Obrador", "=1+1"])
    expect(totals[0]).toBe("TOTAL")
    expect(totals[8]).toBe(100)
    expect(totals[19]).toBe(121)

    const files = unzipSync(buffer)
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"])
    const styles = strFromU8(files["xl/styles.xml"])
    expect(sheet).toMatch(/<pane\b[^>]*\bySplit="1"[^>]*\bstate="frozen"/)
    expect(sheet).toContain('<autoFilter ref="A1:V3"/>')
    expect(sheet).toContain('fitToPage="1"')
    expect(sheet).toMatch(/<pageSetup\b[^>]*\borientation="landscape"[^>]*\bfitToWidth="1"/)
    expect(sheet).not.toContain("<f>")
    expect(styles).toContain('formatCode="dd/mm/yyyy"')
    expect(styles).toContain('formatCode="#,##0.00"')
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
      entity: "COFFEE_SHOP",
    }])
    expect(rows[0]).toMatchObject({ number: 1, invoiceNumber: "CAP-1", supplier: "Proveedor independiente", entity: "COFFEE_SHOP", base21: 100, vat21: 21, invoiceTotal: 121, origin: "CAPTURA GESTORÍA SIN VÍNCULO" })
  })

  it("marks an operational row as combined when it has a Gestoría capture", () => {
    const rows = buildAccountingRows({
      invoices: [{ ...invoice, accountingInvoice: { id: "capture-1" } }],
      expenses: [],
      expensesLegacy: [],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].origin).toBe("FACTURA OPERATIVA + GESTORÍA")
  })

  it("keeps voided operational invoices out of accounting totals", () => {
    const rows = buildAccountingRows({
      invoices: [{ ...invoice, workflowStatus: "VOID" }],
      expenses: [],
      expensesLegacy: [],
    })

    expect(rows[0]).toMatchObject({ voided: true, concept: "ANULADA" })
  })
})
