import { describe, expect, it } from "vitest"
import {
  buildReconciliationPreflightReport,
  RECONCILIATION_BRIDGE_INDEX,
  REQUIRED_RECONCILIATION_COLUMNS,
} from "../accounting-reconciliation-preflight"

const counts = {
  receipts: 87,
  invoices: 0,
  accountingCaptures: 135,
  linkedCaptures: 0,
  linkedReceipts: 0,
}

describe("accounting reconciliation preflight", () => {
  it("blocks an environment before the bridge migration is applied", () => {
    const report = buildReconciliationPreflightReport({
      presentColumns: [],
      presentIndexes: [],
      counts,
      integrity: { orphanedCaptureLinks: 0, orphanedReceiptLinks: 0, linkedStatusIssues: 0 },
      duplicateKeys: [],
    })

    expect(report).toMatchObject({
      status: "BLOCKED",
      readOnly: true,
      schema: { migrationReady: false, bridgeUniqueIndexPresent: false },
    })
    expect(report.blockers[0]).toContain(REQUIRED_RECONCILIATION_COLUMNS[0])
  })

  it("reports warnings without blocking a valid schema", () => {
    const report = buildReconciliationPreflightReport({
      presentColumns: [...REQUIRED_RECONCILIATION_COLUMNS],
      presentIndexes: [RECONCILIATION_BRIDGE_INDEX],
      counts,
      integrity: { orphanedCaptureLinks: 0, orphanedReceiptLinks: 0, linkedStatusIssues: 1 },
      duplicateKeys: [{
        taxId: "B12345678",
        invoiceNumber: "A42",
        captureIds: ["capture-1", "capture-2"],
        captures: [
          { id: "capture-1", date: "2026-01-01", supplierOrCreditor: "Proveedor", invoiceTotal: 10, createdAt: "2026-01-01" },
          { id: "capture-2", date: "2026-01-02", supplierOrCreditor: "Proveedor", invoiceTotal: 10, createdAt: "2026-01-02" },
        ],
      }],
    })

    expect(report).toMatchObject({ status: "WARNINGS", schema: { migrationReady: true } })
    expect(report.warnings).toHaveLength(2)
  })

  it("is ready when schema and integrity checks pass", () => {
    const report = buildReconciliationPreflightReport({
      presentColumns: [...REQUIRED_RECONCILIATION_COLUMNS],
      presentIndexes: [RECONCILIATION_BRIDGE_INDEX],
      counts,
      integrity: { orphanedCaptureLinks: 0, orphanedReceiptLinks: 0, linkedStatusIssues: 0 },
      duplicateKeys: [],
    })

    expect(report.status).toBe("READY")
    expect(report.blockers).toEqual([])
    expect(report.warnings).toEqual([])
  })
})
