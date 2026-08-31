import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { recalculateShiftFondoFinal } from "@/lib/shift-fondo"

export const paymentEntitySchema = z.enum(["OBRADOR", "CAFETERIA"])
export const paymentFunctionSchema = z.enum([
  "REGISTRAR",
  "SOLICITAR",
  "AUTORIZAR",
  "EJECUTAR",
  "CONCILIAR",
  "ADMINISTRAR",
])

export const applicationSchema = z.object({
  tipoDestino: z.enum(["FACTURA", "GASTO", "ANTICIPO"]),
  destinoId: z.string().min(1),
  importeAplicado: z.coerce.number().finite().positive(),
})

export const createPaymentSchema = z.object({
  entidad: paymentEntitySchema,
  fechaPago: z.string().min(1),
  medioPagoId: z.string().min(1),
  cuentaFondosId: z.string().min(1),
  acreedorId: z.string().min(1),
  referenciaExterna: z.string().trim().max(40).optional(),
  aplicaciones: z.array(applicationSchema).min(1, "El pago debe aplicarse a un documento"),
  excesoAutorizadoPorId: z.string().optional(),
  motivoExceso: z.string().trim().max(500).optional(),
})

export const createExpenseSchema = z.object({
  entidad: paymentEntitySchema,
  categoriaId: z.string().min(1),
  acreedorId: z.string().optional(),
  contratoId: z.string().optional(),
  concepto: z.string().trim().min(2).max(120),
  fechaDevengo: z.string().min(1),
  importe: z.coerce.number().finite().positive(),
  justificante: z.enum(["FACTURA", "RECIBO", "TICKET", "CONTRATO", "VALE_INTERNO", "SIN_JUSTIFICANTE"]),
})

export const createShiftExpenseSchema = createExpenseSchema.omit({ entidad: true, justificante: true })

export const authorizeExpenseSchema = z.object({
  autorizadorId: z.string().min(1),
  aprobar: z.boolean(),
  motivoRechazo: z.string().trim().max(500).optional(),
})

export const createAdvanceSchema = z.object({
  entidad: paymentEntitySchema,
  acreedorId: z.string().min(1),
  concepto: z.string().trim().min(2).max(120),
  fecha: z.string().min(1),
  importe: z.coerce.number().finite().positive(),
})

export const authorizeAdvanceSchema = z.object({
  autorizadorId: z.string().min(1),
  aprobar: z.boolean(),
})

export type PaymentEntity = z.infer<typeof paymentEntitySchema>
export type PaymentFunction = z.infer<typeof paymentFunctionSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type CreateShiftExpenseInput = z.infer<typeof createShiftExpenseSchema>

export class PaymentDomainError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = "PAYMENT_VALIDATION") {
    super(message)
    this.name = "PaymentDomainError"
    this.status = status
    this.code = code
  }
}

type Database = typeof prisma | Prisma.TransactionClient

function decimal(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value)
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), decimal(0))
}

function parseDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new PaymentDomainError("Fecha no válida")
  return date
}

export function serializePaymentError(error: unknown) {
  if (error instanceof PaymentDomainError) {
    return { error: error.message, code: error.code, status: error.status }
  }
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message || "Datos no válidos", code: "INVALID_INPUT", status: 400 }
  }
  return { error: "Error interno del módulo de pagos", code: "PAYMENT_ERROR", status: 500 }
}

export async function userHasPaymentFunction(
  userId: string,
  functionName: PaymentFunction,
  entity?: PaymentEntity,
  role?: string,
  db: Database = prisma,
) {
  const assignment = await db.asignacionPagoUsuario.findFirst({
    where: {
      userId,
      funcion: functionName,
      activo: true,
      OR: [{ entidad: null }, ...(entity ? [{ entidad: entity }] : [])],
      vigenteDesde: { lte: new Date() },
      AND: [{ OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: new Date() } }] }],
    },
    select: { id: true },
  })
  if (assignment) return true

  // Transitional access keeps the existing ADMIN/SOCIO dashboards usable until
  // the first explicit payment assignments are seeded.
  if (role === "ADMIN") return true
  if (role === "SOCIO" && ["REGISTRAR", "SOLICITAR", "AUTORIZAR", "EJECUTAR", "CONCILIAR"].includes(functionName)) return true
  return false
}

export async function requirePaymentFunction(
  userId: string,
  functionName: PaymentFunction,
  entity: PaymentEntity | undefined,
  role: string,
  db: Database = prisma,
) {
  const allowed = await userHasPaymentFunction(userId, functionName, entity, role, db)
  if (!allowed) throw new PaymentDomainError("No tienes permiso para esta operación", 403, "PAYMENT_FORBIDDEN")
}

export async function requireAmountAuthorization(
  userId: string,
  role: string,
  entity: PaymentEntity,
  amount: number | string | Prisma.Decimal,
  db: Database = prisma,
) {
  const rules = await db.reglaAutorizacion.findMany({
    where: {
      activo: true,
      funcionRequerida: "AUTORIZAR",
      importeDesde: { lte: decimal(amount) },
      OR: [{ entidad: entity }, { entidad: null }],
      AND: [{ OR: [{ importeHasta: null }, { importeHasta: { gt: decimal(amount) } }] }, { vigenteDesde: { lte: new Date() } }, { OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: new Date() } }] }],
    },
    orderBy: [{ entidad: "desc" }, { importeDesde: "desc" }, { version: "desc" }],
    take: 1,
  })
  if (!rules[0]) throw new PaymentDomainError("La matriz de autorización no está configurada para este importe", 409, "AUTHORIZATION_MATRIX_NOT_CONFIGURED")
  const requiredFunction = rules[0].funcionRequerida
  await requirePaymentFunction(userId, requiredFunction, entity, role, db)
}

export async function auditPaymentEvent(
  db: Database,
  input: {
    actorId?: string
    accion: string
    tipoRegistro: string
    registroId: string
    entidad?: PaymentEntity
    motivo?: string
    antes?: unknown
    despues?: unknown
  },
) {
  return db.eventoAuditoria.create({
    data: {
      actorId: input.actorId,
      accion: input.accion,
      tipoRegistro: input.tipoRegistro,
      registroId: input.registroId,
      entidad: input.entidad,
      motivo: input.motivo,
      antes: input.antes as Prisma.InputJsonValue | undefined,
      despues: input.despues as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function ensureAcreedorForProveedor(
  db: Database,
  provider: { id: string; razonSocial: string; cifNif: string },
  createdById?: string,
) {
  return db.acreedor.upsert({
    where: { proveedorId: provider.id },
    update: { nombre: provider.razonSocial, nif: provider.cifNif, estado: "ACTIVO" },
    create: {
      codigo: `PRV-${provider.id.slice(-8).toUpperCase()}`,
      tipo: "PROVEEDOR_MERCANCIA",
      nombre: provider.razonSocial,
      nif: provider.cifNif,
      proveedorId: provider.id,
      createdById: createdById || null,
    },
  })
}

async function ensureAcreedorCompraMenor(entity: PaymentEntity, createdById: string) {
  const code = `MEN-${entity}`
  return prisma.acreedor.upsert({
    where: { codigo: code },
    update: { estado: "ACTIVO" },
    create: { codigo: code, tipo: "OTROS", nombre: `Compras menores ${entity.toLowerCase()}`, entidadHabitual: entity, estado: "ACTIVO", createdById },
  })
}

async function lockTarget(db: Prisma.TransactionClient, type: "Factura" | "GastoCorriente" | "Anticipo", id: string) {
  if (type === "Factura") {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Factura" WHERE "id" = ${id} FOR UPDATE`)
  } else if (type === "GastoCorriente") {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "GastoCorriente" WHERE "id" = ${id} FOR UPDATE`)
  } else {
    await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Anticipo" WHERE "id" = ${id} FOR UPDATE`)
  }
}

async function existingApplicationTotal(db: Prisma.TransactionClient, field: "facturaId" | "gastoId" | "anticipoId", id: string) {
  const aggregate = await db.pagoAplicacion.aggregate({
    _sum: { importeAplicado: true },
    where: { [field]: id, pago: { estado: { not: "ANULADO" } } },
  })
  return decimal(aggregate._sum.importeAplicado || 0)
}

async function nextPaymentNumber(db: Prisma.TransactionClient, entity: PaymentEntity) {
  const sequence = await db.secuenciaPago.upsert({
    where: { entidad: entity },
    create: { entidad: entity, ultimoNumero: 1 },
    update: { ultimoNumero: { increment: 1 } },
  })
  return sequence.ultimoNumero
}

type PaymentTarget = {
  tipoDestino: "FACTURA" | "GASTO" | "ANTICIPO"
  destinoId: string
  importeAplicado: Prisma.Decimal
  factura?: { id: string; entidad: PaymentEntity; acreedorId: string | null; estadoCircuito: string; importeConformado: Prisma.Decimal | null; importeRetenido: Prisma.Decimal }
  gasto?: { id: string; entidad: PaymentEntity; acreedorId: string | null; estado: string; importe: Prisma.Decimal; categoria: { codigo: string } }
  anticipo?: { id: string; entidad: PaymentEntity; acreedorId: string; estado: string; importe: Prisma.Decimal; importeAplicado: Prisma.Decimal }
}

async function loadAndValidateTarget(
  db: Prisma.TransactionClient,
  input: z.infer<typeof applicationSchema>,
  entity: PaymentEntity,
  creditorId: string,
  allowExcess: boolean,
) : Promise<PaymentTarget> {
  const amount = decimal(input.importeAplicado)
  if (input.tipoDestino === "FACTURA") {
    await lockTarget(db, "Factura", input.destinoId)
    const factura = await db.factura.findUnique({
      where: { id: input.destinoId },
      select: { id: true, entidad: true, acreedorId: true, estadoCircuito: true, importeConformado: true, importeRetenido: true },
    })
    if (!factura) throw new PaymentDomainError("Factura no encontrada", 404, "DOCUMENT_NOT_FOUND")
    if (factura.entidad !== entity) throw new PaymentDomainError("La factura pertenece a otra entidad", 409, "ENTITY_MISMATCH")
    if (!factura.acreedorId || factura.acreedorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con la factura", 409, "CREDITOR_MISMATCH")
    if (!["CONFORMADA", "PARCIALMENTE_CONFORMADA"].includes(factura.estadoCircuito)) throw new PaymentDomainError("La factura no está conformada", 409, "DOCUMENT_NOT_PAYABLE")
    if (!factura.importeConformado) throw new PaymentDomainError("La factura no tiene importe conformado", 409, "MISSING_CONFORMED_AMOUNT")
    const applied = await existingApplicationTotal(db, "facturaId", factura.id)
    const pending = factura.importeConformado.minus(applied)
    if (amount.greaterThan(pending) && !allowExcess) throw new PaymentDomainError("El importe supera el pendiente conformado", 409, "AMOUNT_OVER_PENDING")
    return { tipoDestino: input.tipoDestino, destinoId: input.destinoId, importeAplicado: amount, factura }
  }

  if (input.tipoDestino === "GASTO") {
    await lockTarget(db, "GastoCorriente", input.destinoId)
    const gasto = await db.gastoCorriente.findUnique({
      where: { id: input.destinoId },
      select: { id: true, entidad: true, acreedorId: true, estado: true, importe: true, categoria: { select: { codigo: true } } },
    })
    if (!gasto) throw new PaymentDomainError("Gasto no encontrado", 404, "DOCUMENT_NOT_FOUND")
    if (gasto.entidad !== entity) throw new PaymentDomainError("El gasto pertenece a otra entidad", 409, "ENTITY_MISMATCH")
    if (!gasto.acreedorId || gasto.acreedorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con el gasto", 409, "CREDITOR_MISMATCH")
    if (gasto.estado !== "AUTORIZADO" && gasto.estado !== "PAGADO") throw new PaymentDomainError("El gasto no está autorizado", 409, "DOCUMENT_NOT_PAYABLE")
    const applied = await existingApplicationTotal(db, "gastoId", gasto.id)
    if (amount.greaterThan(gasto.importe.minus(applied))) throw new PaymentDomainError("El importe supera el pendiente del gasto", 409, "AMOUNT_OVER_PENDING")
    if (gasto.categoria.codigo === "MEN") {
      if (!allowExcess && input.importeAplicado <= 0) throw new PaymentDomainError("Compra menor no válida")
    }
    return { tipoDestino: input.tipoDestino, destinoId: input.destinoId, importeAplicado: amount, gasto }
  }

  await lockTarget(db, "Anticipo", input.destinoId)
  const anticipo = await db.anticipo.findUnique({
    where: { id: input.destinoId },
    select: { id: true, entidad: true, acreedorId: true, estado: true, importe: true, importeAplicado: true },
  })
  if (!anticipo) throw new PaymentDomainError("Anticipo no encontrado", 404, "DOCUMENT_NOT_FOUND")
  if (anticipo.entidad !== entity) throw new PaymentDomainError("El anticipo pertenece a otra entidad", 409, "ENTITY_MISMATCH")
  if (anticipo.acreedorId !== creditorId) throw new PaymentDomainError("El acreedor no coincide con el anticipo", 409, "CREDITOR_MISMATCH")
  if (anticipo.estado !== "AUTORIZADO" && anticipo.estado !== "PAGADO") throw new PaymentDomainError("El anticipo no está autorizado", 409, "DOCUMENT_NOT_PAYABLE")
  const pending = anticipo.importe.minus(anticipo.importeAplicado)
  if (amount.greaterThan(pending)) throw new PaymentDomainError("El importe supera el pendiente del anticipo", 409, "AMOUNT_OVER_PENDING")
  return { tipoDestino: input.tipoDestino, destinoId: input.destinoId, importeAplicado: amount, anticipo }
}

export async function createPayment(user: { id: string; role: string }, input: CreatePaymentInput) {
  await requirePaymentFunction(user.id, "EJECUTAR", input.entidad, user.role)
  const parsedDate = parseDate(input.fechaPago)

  return prisma.$transaction(async (tx) => {
    const method = await tx.medioPago.findUnique({ where: { id: input.medioPagoId } })
    if (!method || method.estado !== "ACTIVO") throw new PaymentDomainError("Medio de pago no disponible", 409, "PAYMENT_METHOD_UNAVAILABLE")
    const account = await tx.cuentaFondos.findUnique({ where: { id: input.cuentaFondosId } })
    if (!account || account.estado !== "ACTIVA") throw new PaymentDomainError("Cuenta de fondos no disponible", 409, "FUND_ACCOUNT_UNAVAILABLE")
    if (account.entidad !== input.entidad) throw new PaymentDomainError("La cuenta no pertenece a la entidad del pago", 409, "ENTITY_MISMATCH")
    if (method.requiereCuenta && !input.cuentaFondosId) throw new PaymentDomainError("La cuenta de origen es obligatoria")
    if (method.tipo === "EFECTIVO" && account.tipo !== "CAJA" && account.tipo !== "CAJA_CHICA") throw new PaymentDomainError("El efectivo debe salir de una caja", 409, "CASH_ACCOUNT_REQUIRED")
    if (method.limiteOperacion && sum(input.aplicaciones.map((item) => decimal(item.importeAplicado))).greaterThan(method.limiteOperacion)) throw new PaymentDomainError("El pago supera el límite del medio", 409, "PAYMENT_METHOD_LIMIT")

    const allowExcess = Boolean(input.excesoAutorizadoPorId)
    if (allowExcess) {
      const excessAuthorizerId = input.excesoAutorizadoPorId!
      if (!input.motivoExceso) throw new PaymentDomainError("El motivo del exceso es obligatorio", 400, "EXCESS_REASON_REQUIRED")
      if (excessAuthorizerId === user.id) throw new PaymentDomainError("El ejecutor no puede autorizar su propio exceso", 409, "SEGREGATION_VIOLATION")
      const authorized = await userHasPaymentFunction(excessAuthorizerId, "AUTORIZAR", input.entidad, undefined, tx)
      if (!authorized) throw new PaymentDomainError("El usuario indicado no puede autorizar el exceso", 403, "EXCESS_AUTHORIZATION_INVALID")
    }

    const creditor = await tx.acreedor.findUnique({ where: { id: input.acreedorId }, select: { id: true, estado: true, tipo: true } })
    if (!creditor || creditor.estado !== "ACTIVO") throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
    if (creditor.tipo === "PROVEEDOR_MERCANCIA" && input.aplicaciones.some((application) => application.tipoDestino !== "FACTURA")) throw new PaymentDomainError("Un proveedor de mercancía solo puede pagarse mediante facturas conformadas", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
    const destinations = input.aplicaciones.map((application) => `${application.tipoDestino}:${application.destinoId}`)
    if (new Set(destinations).size !== destinations.length) throw new PaymentDomainError("No puedes repetir el mismo documento en un pago", 409, "DUPLICATE_APPLICATION")

    const targets: PaymentTarget[] = []
    for (const application of input.aplicaciones) {
      targets.push(await loadAndValidateTarget(tx, application, input.entidad, input.acreedorId, allowExcess))
    }
    if (targets.some((target) => target.gasto?.categoria.codigo === "MEN") && account.tipo !== "CAJA_CHICA") throw new PaymentDomainError("Las compras menores solo se pagan desde caja chica", 409, "MINOR_PURCHASE_CASH_ONLY")
    const total = sum(targets.map((target) => target.importeAplicado))
    if (total.lte(0)) throw new PaymentDomainError("El importe total debe ser mayor que cero")

    if (method.tipo === "EFECTIVO" && account.saldoTeorico.lessThan(total)) throw new PaymentDomainError("Saldo insuficiente en la caja", 409, "INSUFFICIENT_CASH")

    const number = await nextPaymentNumber(tx, input.entidad)
    const payment = await tx.pago.create({
      data: {
        numero: number,
        entidad: input.entidad,
        fechaPago: parsedDate,
        medioPagoId: input.medioPagoId,
        cuentaFondosId: input.cuentaFondosId,
        acreedorId: input.acreedorId,
        importeTotal: total,
        referenciaExterna: input.referenciaExterna || null,
        ejecutadoPorId: user.id,
        estado: "ORDENADO",
        excesoAutorizadoPorId: input.excesoAutorizadoPorId || null,
        motivoExceso: input.motivoExceso || null,
        aplicaciones: {
          create: targets.map((target) => ({
            tipoDestino: target.tipoDestino,
            facturaId: target.tipoDestino === "FACTURA" ? target.destinoId : null,
            gastoId: target.tipoDestino === "GASTO" ? target.destinoId : null,
            anticipoId: target.tipoDestino === "ANTICIPO" ? target.destinoId : null,
            importeAplicado: target.importeAplicado,
          })),
        },
      },
      include: { aplicaciones: true },
    })

    await tx.movimientoFondos.create({
      data: {
        cuentaFondosId: account.id,
        entidad: input.entidad,
        tipo: "SALIDA_PAGO",
        importe: total.negated(),
        descripcion: `Pago ${input.entidad}-${number}`,
        origenTipo: "PAGO",
        origenId: payment.id,
        pagoId: payment.id,
        creadoPorId: user.id,
      },
    })
    await tx.cuentaFondos.update({ where: { id: account.id }, data: { saldoTeorico: { decrement: total } } })

    for (const target of targets) {
      if (target.factura) {
        const applied = await existingApplicationTotal(tx, "facturaId", target.factura.id)
        const remaining = target.factura.importeConformado!.minus(applied)
        await tx.factura.update({
          where: { id: target.factura.id },
          data: { estadoPago: remaining.lte(0) ? "PAGADA" : "PARCIAL", importePagado: applied },
        })
      }
      if (target.gasto) {
        const applied = await existingApplicationTotal(tx, "gastoId", target.gasto.id)
        await tx.gastoCorriente.update({ where: { id: target.gasto.id }, data: { estado: applied.gte(target.gasto.importe) ? "PAGADO" : "AUTORIZADO" } })
      }
      if (target.anticipo) {
        await tx.anticipo.update({ where: { id: target.anticipo.id }, data: { importeAplicado: { increment: target.importeAplicado }, estado: target.anticipo.importeAplicado.plus(target.importeAplicado).gte(target.anticipo.importe) ? "PAGADO" : "AUTORIZADO" } })
      }
    }

    if (input.excesoAutorizadoPorId) {
      await tx.aprobacionPago.create({ data: { pagoId: payment.id, usuarioId: input.excesoAutorizadoPorId, tipo: "EXCESO_CONFORMADO", motivo: input.motivoExceso! } })
    }
    await auditPaymentEvent(tx, { actorId: user.id, accion: "PAGO_CREADO", tipoRegistro: "Pago", registroId: payment.id, entidad: input.entidad, motivo: input.motivoExceso, despues: { numero: number, importeTotal: total.toString(), aplicaciones: input.aplicaciones } })
    return payment
  })
}

export async function createExpense(user: { id: string; role: string }, input: CreateExpenseInput, options: { shiftId?: string; skipSolicitarPermission?: boolean } = {}) {
  if (!options.skipSolicitarPermission) await requirePaymentFunction(user.id, "SOLICITAR", input.entidad, user.role)
  const date = parseDate(input.fechaDevengo)
  const amount = decimal(input.importe)

  const category = await prisma.categoriaGasto.findUnique({ where: { id: input.categoriaId }, select: { id: true, codigo: true, activo: true } })
  if (!category?.activo) throw new PaymentDomainError("Categoría de gasto no disponible", 409, "CATEGORY_UNAVAILABLE")

  if (input.concepto.trim().split(/\s+/).length === 1) throw new PaymentDomainError("El concepto debe ser específico y no una sola palabra", 400, "GENERIC_CONCEPT")
  if (!input.acreedorId && category.codigo !== "PER" && !(category.codigo === "MEN" && input.justificante === "SIN_JUSTIFICANTE")) throw new PaymentDomainError("El acreedor es obligatorio para este gasto", 400, "CREDITOR_REQUIRED")

  if (category.codigo === "OTR") {
    const direction = await userHasPaymentFunction(user.id, "AUTORIZAR", input.entidad, user.role)
    if (!direction) throw new PaymentDomainError("La categoría OTR requiere autorización de dirección", 403, "OTHER_CATEGORY_REQUIRES_DIRECTION")
  }

  if (input.acreedorId) {
    const creditor = await prisma.acreedor.findUnique({ where: { id: input.acreedorId }, select: { tipo: true, estado: true } })
    if (!creditor || creditor.estado !== "ACTIVO") throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
    if (creditor.tipo === "PROVEEDOR_MERCANCIA") throw new PaymentDomainError("Un proveedor de mercancía solo puede pagarse mediante factura conformada", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
  }

  const creditorId = input.acreedorId || (category.codigo === "MEN" ? (await ensureAcreedorCompraMenor(input.entidad, user.id)).id : null)
  const expense = await prisma.gastoCorriente.create({
    data: {
      entidad: input.entidad,
      categoriaId: input.categoriaId,
      acreedorId: creditorId,
      contratoId: input.contratoId || null,
      shiftId: options.shiftId || null,
      concepto: input.concepto.trim(),
      fechaDevengo: date,
      importe: amount,
      justificante: input.justificante,
      solicitanteId: user.id,
      estado: "PENDIENTE_AUTORIZACION",
    },
  })
  await auditPaymentEvent(prisma, { actorId: user.id, accion: "GASTO_CREADO", tipoRegistro: "GastoCorriente", registroId: expense.id, entidad: input.entidad, despues: { importe: amount.toString(), categoriaId: input.categoriaId, shiftId: options.shiftId || null } })
  return expense
}

export async function createExpenseFromShift(user: { id: string; role: string }, shiftId: string, input: CreateShiftExpenseInput) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { id: true, status: true, createdById: true } })
  const canManageAllShifts = user.role === "ADMIN" || user.role === "SOCIO"
  if (!shift || (!canManageAllShifts && shift.createdById !== user.id)) throw new PaymentDomainError("Turno no encontrado", 404, "SHIFT_NOT_FOUND")
  if (shift.status !== "ABIERTO") throw new PaymentDomainError("El turno debe estar abierto para registrar el gasto", 409, "SHIFT_NOT_OPEN")

  const expense = await createExpense(user, { ...input, entidad: "CAFETERIA", justificante: "SIN_JUSTIFICANTE" }, { shiftId, skipSolicitarPermission: true })
  await recalculateShiftFondoFinal(shiftId)
  return expense
}

export async function createAdvance(user: { id: string; role: string }, input: z.infer<typeof createAdvanceSchema>) {
  await requirePaymentFunction(user.id, "SOLICITAR", input.entidad, user.role)
  const date = parseDate(input.fecha)
  if (input.concepto.trim().split(/\s+/).length === 1) throw new PaymentDomainError("El concepto debe ser específico y no una sola palabra", 400, "GENERIC_CONCEPT")
  const creditor = await prisma.acreedor.findUnique({ where: { id: input.acreedorId }, select: { id: true, tipo: true, estado: true } })
  if (!creditor || creditor.estado !== "ACTIVO") throw new PaymentDomainError("Acreedor no disponible", 409, "CREDITOR_UNAVAILABLE")
  if (creditor.tipo === "PROVEEDOR_MERCANCIA") throw new PaymentDomainError("Un proveedor de mercancía no puede recibir anticipos por este circuito", 409, "MERCHANDISE_CREDITOR_REQUIRES_INVOICE")
  const advance = await prisma.anticipo.create({ data: { entidad: input.entidad, acreedorId: input.acreedorId, concepto: input.concepto.trim(), fecha: date, importe: input.importe, solicitadoPorId: user.id, estado: "PENDIENTE_AUTORIZACION" } })
  await auditPaymentEvent(prisma, { actorId: user.id, accion: "ANTICIPO_CREADO", tipoRegistro: "Anticipo", registroId: advance.id, entidad: input.entidad, despues: { importe: input.importe, acreedorId: input.acreedorId } })
  return advance
}

export async function authorizeAdvance(user: { id: string; role: string }, advanceId: string, input: z.infer<typeof authorizeAdvanceSchema>) {
  const advance = await prisma.anticipo.findUnique({ where: { id: advanceId } })
  if (!advance) throw new PaymentDomainError("Anticipo no encontrado", 404, "DOCUMENT_NOT_FOUND")
  await requirePaymentFunction(user.id, "AUTORIZAR", advance.entidad, user.role)
  if (input.autorizadorId !== user.id) throw new PaymentDomainError("El autorizador debe ser el usuario autenticado", 403, "AUTHORIZER_MISMATCH")
  if (advance.solicitadoPorId === user.id) throw new PaymentDomainError("Nadie puede autorizar su propio anticipo", 409, "SEGREGATION_VIOLATION")
  if (advance.estado !== "PENDIENTE_AUTORIZACION") throw new PaymentDomainError("El anticipo no está pendiente de autorización", 409, "INVALID_STATE")
  await requireAmountAuthorization(user.id, user.role, advance.entidad, advance.importe)
  const updated = await prisma.anticipo.update({ where: { id: advance.id }, data: input.aprobar ? { estado: "AUTORIZADO", autorizadoPorId: user.id } : { estado: "ANULADO", autorizadoPorId: user.id } })
  await auditPaymentEvent(prisma, { actorId: user.id, accion: input.aprobar ? "ANTICIPO_AUTORIZADO" : "ANTICIPO_RECHAZADO", tipoRegistro: "Anticipo", registroId: advance.id, entidad: advance.entidad })
  return updated
}

export async function authorizeExpense(user: { id: string; role: string }, expenseId: string, input: z.infer<typeof authorizeExpenseSchema>) {
  const expense = await prisma.gastoCorriente.findUnique({ where: { id: expenseId }, include: { categoria: true } })
  if (!expense) throw new PaymentDomainError("Gasto no encontrado", 404, "DOCUMENT_NOT_FOUND")
  await requirePaymentFunction(user.id, "AUTORIZAR", expense.entidad, user.role)
  if (input.autorizadorId !== user.id) throw new PaymentDomainError("El autorizador debe ser el usuario autenticado", 403, "AUTHORIZER_MISMATCH")
  if (expense.solicitanteId === user.id) throw new PaymentDomainError("Nadie puede autorizar su propio gasto", 409, "SEGREGATION_VIOLATION")
  if (expense.estado !== "PENDIENTE_AUTORIZACION") throw new PaymentDomainError("El gasto no está pendiente de autorización", 409, "INVALID_STATE")
  if (!input.aprobar && !input.motivoRechazo) throw new PaymentDomainError("El rechazo debe tener un motivo")
  if (input.aprobar) await requireAmountAuthorization(user.id, user.role, expense.entidad, expense.importe)

  const updated = await prisma.gastoCorriente.update({
    where: { id: expense.id },
    data: input.aprobar ? { estado: "AUTORIZADO", autorizadorId: user.id, autorizadoAt: new Date(), motivoRechazo: null } : { estado: "RECHAZADO", autorizadorId: user.id, autorizadoAt: new Date(), motivoRechazo: input.motivoRechazo },
  })
  await auditPaymentEvent(prisma, { actorId: user.id, accion: input.aprobar ? "GASTO_AUTORIZADO" : "GASTO_RECHAZADO", tipoRegistro: "GastoCorriente", registroId: expense.id, entidad: expense.entidad, motivo: input.motivoRechazo })
  return updated
}

export async function deleteCurrentExpense(user: { id: string; role: string }, expenseId: string) {
  if (user.role !== "ADMIN" && user.role !== "SOCIO") {
    throw new PaymentDomainError("No tienes permiso para eliminar gastos corrientes", 403, "PAYMENT_FORBIDDEN")
  }

  const expense = await prisma.gastoCorriente.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      entidad: true,
      shiftId: true,
      estado: true,
      importe: true,
      aplicaciones: { select: { id: true } },
    },
  })
  if (!expense || !expense.shiftId || expense.estado === "ANULADO") {
    throw new PaymentDomainError("Gasto corriente no encontrado", 404, "DOCUMENT_NOT_FOUND")
  }
  if (expense.aplicaciones.length > 0) {
    throw new PaymentDomainError("No se puede eliminar un gasto con pagos aplicados", 409, "EXPENSE_HAS_PAYMENTS")
  }

  const updated = await prisma.gastoCorriente.update({
    where: { id: expense.id },
    data: { estado: "ANULADO" },
  })
  await auditPaymentEvent(prisma, {
    actorId: user.id,
    accion: "GASTO_ANULADO",
    tipoRegistro: "GastoCorriente",
    registroId: expense.id,
    entidad: expense.entidad,
    motivo: "Eliminado desde el seguimiento de gastos corrientes",
    antes: { estado: expense.estado, importe: expense.importe.toString(), shiftId: expense.shiftId },
    despues: { estado: "ANULADO", importe: expense.importe.toString(), shiftId: expense.shiftId },
  })
  await recalculateShiftFondoFinal(expense.shiftId)
  return updated
}

export async function getPaymentDashboard(entity?: PaymentEntity) {
  const where = entity ? { entidad: entity } : {}
  const [invoices, expenses, pendingExpenses, payments, cashAccounts, methods] = await Promise.all([
    prisma.factura.findMany({ where: { ...where, estadoCircuito: { in: ["CONFORMADA", "PARCIALMENTE_CONFORMADA"] }, acreedorId: { not: null } }, include: { acreedor: { select: { id: true, nombre: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } }, select: { importeAplicado: true } } }, orderBy: [{ fechaVencimiento: "asc" }, { createdAt: "asc" }], take: 100 }),
    prisma.gastoCorriente.findMany({ where: { ...where, estado: { in: ["PENDIENTE_AUTORIZACION", "AUTORIZADO"] } }, include: { categoria: true, acreedor: { select: { id: true, nombre: true } }, solicitante: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, turno: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } }, select: { importeAplicado: true } } }, orderBy: { fechaDevengo: "desc" }, take: 100 }),
    prisma.gastoCorriente.findMany({ where: { ...where, estado: "PENDIENTE_AUTORIZACION", shiftId: { not: null } }, include: { categoria: true, acreedor: { select: { id: true, nombre: true } }, solicitante: { select: { id: true, name: true, email: true } }, shift: { select: { id: true, date: true, turno: true } }, aplicaciones: { where: { pago: { estado: { not: "ANULADO" } } }, select: { importeAplicado: true } } }, orderBy: { fechaDevengo: "desc" }, take: 500 }),
    prisma.pago.findMany({ where, include: { acreedor: { select: { id: true, nombre: true } }, medioPago: true, cuentaFondos: true, aplicaciones: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.cuentaFondos.findMany({ where: { ...where, estado: "ACTIVA" }, orderBy: [{ entidad: "asc" }, { id: "asc" }] }),
    prisma.medioPago.findMany({ where: { estado: "ACTIVO" }, orderBy: { id: "asc" } }),
  ])
  return { invoices, expenses, pendingExpenses, payments, cashAccounts, methods }
}

export async function getIndicators(entity: PaymentEntity, from: Date, to: Date) {
  const [payments, cashPayments, noInvoiceExpenses, otherExpenses, pendingStatements, overdueInvoices, oldAdvances] = await Promise.all([
    prisma.pago.findMany({ where: { entidad: entity, fechaPago: { gte: from, lt: to }, estado: { not: "ANULADO" } }, select: { importeTotal: true, excesoAutorizadoPorId: true } }),
    prisma.pago.aggregate({ _sum: { importeTotal: true }, where: { entidad: entity, fechaPago: { gte: from, lt: to }, estado: { not: "ANULADO" }, medioPago: { tipo: "EFECTIVO" } } }),
    prisma.gastoCorriente.aggregate({ _sum: { importe: true }, where: { entidad: entity, fechaDevengo: { gte: from, lt: to }, justificante: "SIN_JUSTIFICANTE", estado: { not: "ANULADO" } } }),
    prisma.gastoCorriente.aggregate({ _sum: { importe: true }, where: { entidad: entity, fechaDevengo: { gte: from, lt: to }, categoria: { codigo: "OTR" }, estado: { not: "ANULADO" } } }),
    prisma.movimientoExtracto.count({ where: { cuentaFondos: { entidad: entity }, direccion: "SALIDA", estado: { not: "CONCILIADO" }, fechaValor: { gte: from, lt: to } } }),
    prisma.factura.count({ where: { entidad: entity, estadoCircuito: { in: ["CONFORMADA", "PARCIALMENTE_CONFORMADA"] }, fechaVencimiento: { lt: new Date() }, estadoPago: { not: "PAGADA" } } }),
    prisma.anticipo.count({ where: { entidad: entity, fecha: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, estado: { notIn: ["PAGADO", "ANULADO"] } } }),
  ])
  const total = sum(payments.map((payment) => decimal(payment.importeTotal)))
  const cash = decimal(cashPayments._sum.importeTotal || 0)
  return {
    P1: { cantidad: payments.filter((payment) => payment.excesoAutorizadoPorId).length, importe: payments.filter((payment) => payment.excesoAutorizadoPorId).reduce((totalAmount, payment) => totalAmount.plus(payment.importeTotal), decimal(0)) },
    P1c: overdueInvoices,
    P3: { importe: cash, porcentaje: total.isZero() ? decimal(0) : cash.div(total).mul(100) },
    P4: noInvoiceExpenses._sum.importe || decimal(0),
    P5: pendingStatements,
    P6: otherExpenses._sum.importe || decimal(0),
    P7: oldAdvances,
  }
}
