import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  const providers = await prisma.proveedor.findMany({ select: { id: true, razonSocial: true, cifNif: true } })
  let creditors = 0
  let invoices = 0

  for (const provider of providers) {
    await prisma.acreedor.upsert({
      where: { proveedorId: provider.id },
      update: { nombre: provider.razonSocial, nif: provider.cifNif },
      create: { codigo: `PRV-${provider.id.slice(-8).toUpperCase()}`, tipo: "PROVEEDOR_MERCANCIA", nombre: provider.razonSocial, nif: provider.cifNif, proveedorId: provider.id },
    })
    creditors += 1
  }

  const invoicesToReview = await prisma.factura.findMany({ where: { acreedorId: null }, select: { id: true, proveedorId: true } })
  for (const invoice of invoicesToReview) {
    const creditor = await prisma.acreedor.findUnique({ where: { proveedorId: invoice.proveedorId }, select: { id: true } })
    if (!creditor) continue
    await prisma.factura.update({ where: { id: invoice.id }, data: { acreedorId: creditor.id, entidad: "OBRADOR", estadoCircuito: "BORRADOR", esLegacyPago: true } })
    invoices += 1
  }

  console.log(`Acreedores preparados: ${creditors}`)
  console.log(`Facturas migradas a revisión: ${invoices}`)
  console.log("Ninguna factura histórica se ha marcado como conformada automáticamente.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
