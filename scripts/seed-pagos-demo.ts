import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL o DIRECT_URL es obligatorio")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const accounts = [
  { id: "DEM-OBR-01", entidad: "OBRADOR" as const, descripcion: "DEMO Banco Obrador (no real)", ibanUltimos4: "0001", saldo: 5000 },
  { id: "DEM-CAF-01", entidad: "CAFETERIA" as const, descripcion: "DEMO Banco Cafetería (no real)", ibanUltimos4: "0002", saldo: 5000 },
]

const invoices = [
  {
    numero: "001",
    entidad: "OBRADOR" as const,
    total: 537.6,
    conformado: 481,
    retenido: 56.6,
    estado: "PARCIALMENTE_CONFORMADA" as const,
    vencimiento: "2026-08-30",
    referencia: "DEMO-ALB-OBR-001",
    concepto: "Harina y materias primas de demostración",
    neto: 516.92,
    iva: 20.68,
  },
  {
    numero: "002",
    entidad: "OBRADOR" as const,
    total: 214.9,
    conformado: 214.9,
    retenido: 0,
    estado: "CONFORMADA" as const,
    vencimiento: "2026-09-15",
    referencia: "DEMO-ALB-OBR-002",
    concepto: "Suministro de demostración conformado",
    neto: 199,
    iva: 15.9,
  },
  {
    numero: "003",
    entidad: "CAFETERIA" as const,
    total: 89.5,
    conformado: 89.5,
    retenido: 0,
    estado: "CONFORMADA" as const,
    vencimiento: "2026-09-20",
    referencia: "DEMO-ALB-CAF-001",
    concepto: "Suministro cafetería de demostración",
    neto: 83.18,
    iva: 6.32,
  },
]

async function main() {
  const responsible = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  const creditors = await prisma.acreedor.findMany({
    where: { tipo: "PROVEEDOR_MERCANCIA", estado: "ACTIVO" },
    include: { proveedor: true },
    take: 2,
  })
  if (!responsible) throw new Error("No existe un usuario ADMIN para responsabilizar las cuentas demo")
  if (creditors.length < 2) throw new Error("Se necesitan al menos dos acreedores de mercancía activos")

  for (const accountInput of accounts) {
    const existing = await prisma.cuentaFondos.findUnique({ where: { id: accountInput.id } })
    if (existing) {
      console.log(`Cuenta ${accountInput.id} ya existe; no se modifica.`)
      continue
    }

    await prisma.$transaction(async (tx) => {
      const account = await tx.cuentaFondos.create({
        data: {
          id: accountInput.id,
          tipo: "BANCO",
          entidad: accountInput.entidad,
          descripcion: accountInput.descripcion,
          ibanUltimos4: accountInput.ibanUltimos4,
          responsableId: responsible.id,
          saldoTeorico: accountInput.saldo,
          estado: "ACTIVA",
        },
      })
      await tx.movimientoFondos.create({
        data: {
          cuentaFondosId: account.id,
          entidad: account.entidad,
          tipo: "ENTRADA_DOTACION",
          importe: accountInput.saldo,
          descripcion: "Saldo inicial de demostración; no representa una cuenta real",
          origenTipo: "DEMO",
          origenId: account.id,
          creadoPorId: responsible.id,
        },
      })
    })
    console.log(`Cuenta demo creada: ${accountInput.id}`)
  }

  const providerByEntity = new Map([
    ["OBRADOR", creditors[0]],
    ["CAFETERIA", creditors[1]],
  ])

  for (const input of invoices) {
    const creditor = providerByEntity.get(input.entidad)
    if (!creditor?.proveedor) throw new Error(`No hay proveedor para ${input.entidad}`)
    const existing = await prisma.factura.findUnique({ where: { acreedorId_numero: { acreedorId: creditor.id, numero: input.numero } } })
    if (existing) {
      console.log(`Factura DEMO-${input.numero} ya existe; no se modifica.`)
      continue
    }

    const invoice = await prisma.factura.create({
      data: {
        proveedorId: creditor.proveedor.id,
        acreedorId: creditor.id,
        serie: "DEMO",
        numero: input.numero,
        fechaExpedicion: new Date("2026-08-01T00:00:00Z"),
        fechaOperacion: new Date("2026-08-01T00:00:00Z"),
        fechaVencimiento: new Date(`${input.vencimiento}T00:00:00Z`),
        formaPago: "TRANSFERENCIA",
        estado: "CONFIRMADA",
        estadoPago: "PENDIENTE",
        moneda: "EUR",
        entidad: input.entidad,
        tipoDocumento: "COMPRA_MERCANCIA",
        estadoCircuito: input.estado,
        importeConformado: input.conformado,
        importeRetenido: input.retenido,
        motivoRetencion: input.retenido ? "Diferencia retenida de demostración" : null,
        referenciaOrigen: input.referencia,
        razonSocialEmisor: creditor.proveedor.razonSocial,
        nifEmisor: creditor.proveedor.cifNif,
        domicilioFiscalEmisor: creditor.proveedor.direccionFiscal || "Dirección demo",
        totalNeto: input.neto,
        totalDescuento: 0,
        totalIva: input.iva,
        totalRecargo: 0,
        totalRetenciones: 0,
        importeTotal: input.total,
        observaciones: `Factura de demostración para probar pagos: ${input.concepto}`,
        confirmadoPorId: responsible.id,
        lineas: {
          create: {
            tipoLinea: "CARGO",
            descripcion: input.concepto,
            unidadMedida: "ud",
            cantidad: 1,
            descuentoImporte: 0,
            precioUnitario: input.neto,
            precioUnitarioNeto: input.neto,
            baseImponible: input.neto,
            tipoIva: 4,
            cuotaIva: input.iva,
            totalLinea: input.total,
          },
        },
        impuestos: {
          create: { tipo: "IVA", porcentaje: 4, baseImponible: input.neto, cuota: input.iva },
        },
      },
    })
    console.log(`Factura demo creada: ${invoice.id} · ${input.entidad} · DEMO/${input.numero} · ${input.conformado.toFixed(2)} € pagables`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
