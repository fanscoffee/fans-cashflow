import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { CreditorStatus, CreditorType, FundsAccountStatus, FundsAccountType, FundsMovementType, InvoiceWorkflowStatus, PaymentDocumentType, PaymentEntity } from "../src/lib/database-enums"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const accounts = [
  { id: "DEM-OBR-01", entity: PaymentEntity.BAKERY, description: "DEMO Banco Obrador (no real)", ibanLast4: "0001", balance: 5000 },
  { id: "DEM-CAF-01", entity: PaymentEntity.COFFEE_SHOP, description: "DEMO Banco Cafetería (no real)", ibanLast4: "0002", balance: 5000 },
]

const invoices = [
  {
    number: "001",
    entity: PaymentEntity.BAKERY,
    total: 537.6,
    confirmedAmount: 481,
    withheldAmount: 56.6,
    status: InvoiceWorkflowStatus.PARTIALLY_CONFIRMED,
    dueDate: "2026-08-30",
    sourceReference: "DEMO-ALB-OBR-001",
    concept: "Harina y materias primas de demostración",
    netTotal: 516.92,
    vat: 20.68,
  },
  {
    number: "002",
    entity: PaymentEntity.BAKERY,
    total: 214.9,
    confirmedAmount: 214.9,
    withheldAmount: 0,
    status: InvoiceWorkflowStatus.CONFIRMED,
    dueDate: "2026-09-15",
    sourceReference: "DEMO-ALB-OBR-002",
    concept: "Suministro de demostración conformado",
    netTotal: 199,
    vat: 15.9,
  },
  {
    number: "003",
    entity: PaymentEntity.COFFEE_SHOP,
    total: 89.5,
    confirmedAmount: 89.5,
    withheldAmount: 0,
    status: InvoiceWorkflowStatus.CONFIRMED,
    dueDate: "2026-09-20",
    sourceReference: "DEMO-ALB-CAF-001",
    concept: "Suministro cafetería de demostración",
    netTotal: 83.18,
    vat: 6.32,
  },
]

async function main() {
  const responsible = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  const creditors = await prisma.creditor.findMany({
    where: { type: CreditorType.MERCHANDISE_SUPPLIER, status: CreditorStatus.ACTIVE },
    include: { supplier: true },
    take: 2,
  })
  if (!responsible) throw new Error("No existe un usuario ADMIN para responsabilizar las cuentas demo")
  if (creditors.length < 2) throw new Error("Se necesitan al menos dos acreedores de mercancía activos")

  for (const accountInput of accounts) {
    const existing = await prisma.fundsAccount.findUnique({ where: { id: accountInput.id } })
    if (existing) {
      console.log(`Account ${accountInput.id} already exists; leaving it unchanged.`)
      continue
    }

    await prisma.$transaction(async (tx) => {
      const account = await tx.fundsAccount.create({
        data: {
          id: accountInput.id,
          type: FundsAccountType.BANK,
          entity: accountInput.entity,
          description: accountInput.description,
          ibanLast4: accountInput.ibanLast4,
          responsibleUserId: responsible.id,
          theoreticalBalance: accountInput.balance,
          status: FundsAccountStatus.ACTIVE,
        },
      })
      await tx.fundsMovement.create({
        data: {
          fundsAccountId: account.id,
          entity: account.entity,
          type: FundsMovementType.ALLOCATION_INFLOW,
          amount: accountInput.balance,
          description: "Saldo inicial de demostración; no representa una cuenta real",
          sourceType: "DEMO",
          sourceId: account.id,
          createdById: responsible.id,
        },
      })
    })
    console.log(`Demo account created: ${accountInput.id}`)
  }

  const providerByEntity = new Map([
    [PaymentEntity.BAKERY, creditors[0]],
    [PaymentEntity.COFFEE_SHOP, creditors[1]],
  ])

  for (const input of invoices) {
    const creditor = providerByEntity.get(input.entity)
    if (!creditor?.supplier) throw new Error(`No hay proveedor para ${input.entity}`)
    const existing = await prisma.invoice.findUnique({ where: { creditorId_number: { creditorId: creditor.id, number: input.number } } })
    if (existing) {
      console.log(`Invoice DEMO-${input.number} already exists; leaving it unchanged.`)
      continue
    }

    const invoice = await prisma.invoice.create({
      data: {
        supplierId: creditor.supplier.id,
        creditorId: creditor.id,
        series: "DEMO",
        number: input.number,
        issueDate: new Date("2026-08-01T00:00:00Z"),
        operationDate: new Date("2026-08-01T00:00:00Z"),
        dueDate: new Date(`${input.dueDate}T00:00:00Z`),
        paymentMethod: "TRANSFERENCIA",
        status: "CONFIRMADA",
        paymentStatus: "PENDIENTE",
        currency: "EUR",
        entity: input.entity,
        documentType: PaymentDocumentType.MERCHANDISE_PURCHASE,
        workflowStatus: input.status,
        confirmedAmount: input.confirmedAmount,
        withheldAmount: input.withheldAmount,
        withholdingReason: input.withheldAmount ? "Diferencia retenida de demostración" : null,
        sourceReference: input.sourceReference,
        issuerLegalName: creditor.supplier.legalName,
        issuerTaxId: creditor.supplier.taxId,
        issuerBillingAddress: creditor.supplier.billingAddress || "Dirección demo",
        netTotal: input.netTotal,
        discountTotal: 0,
        totalVat: input.vat,
        surchargeTotal: 0,
        withholdingTotal: 0,
        totalAmount: input.total,
        notes: `Factura de demostración para probar pagos: ${input.concept}`,
        confirmedById: responsible.id,
        lines: {
          create: {
            lineType: "CARGO",
            description: input.concept,
            unitOfMeasure: "ud",
            quantity: 1,
            discountAmount: 0,
            unitPrice: input.netTotal,
            netUnitPrice: input.netTotal,
            taxableBase: input.netTotal,
            vatRate: 4,
            vatAmount: input.vat,
            lineTotal: input.total,
          },
        },
        taxes: {
          create: { type: "IVA", percentage: 4, taxableBase: input.netTotal, taxAmount: input.vat },
        },
      },
    })
    console.log(`Demo invoice created: ${invoice.id} · ${input.entity} · DEMO/${input.number} · ${input.confirmedAmount.toFixed(2)} € payable`)
  }
}

main()
  .catch((error) => {
    console.error("Demo payment seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
