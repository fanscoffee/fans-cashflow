import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { CreditorType, InvoiceWorkflowStatus, PaymentEntity } from "../src/lib/database-enums"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  const providers = await prisma.supplier.findMany({ select: { id: true, legalName: true, taxId: true } })
  let creditors = 0
  let invoices = 0

  for (const provider of providers) {
    await prisma.creditor.upsert({
      where: { supplierId: provider.id },
      update: { name: provider.legalName, taxId: provider.taxId },
      create: { code: `PRV-${provider.id.slice(-8).toUpperCase()}`, type: CreditorType.MERCHANDISE_SUPPLIER, name: provider.legalName, taxId: provider.taxId, supplierId: provider.id },
    })
    creditors += 1
  }

  const invoicesToReview = await prisma.invoice.findMany({ where: { creditorId: null }, select: { id: true, supplierId: true } })
  for (const invoice of invoicesToReview) {
    const creditor = await prisma.creditor.findUnique({ where: { supplierId: invoice.supplierId }, select: { id: true } })
    if (!creditor) continue
    await prisma.invoice.update({ where: { id: invoice.id }, data: { creditorId: creditor.id, entity: PaymentEntity.BAKERY, workflowStatus: InvoiceWorkflowStatus.DRAFT, isLegacyPayment: true } })
    invoices += 1
  }

  console.log(`Creditors prepared: ${creditors}`)
  console.log(`Invoices moved to review: ${invoices}`)
  console.log("No historical invoice was automatically marked as confirmed.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
