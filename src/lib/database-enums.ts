import { z } from "zod"
import {
  AccountingInvoiceOrigin,
  CashCountStatus,
  CashDestination,
  CashReplenishmentStatus,
  CreditorStatus,
  CreditorType,
  CurrentExpenseStatus,
  ExpenseReceiptType,
  FundsAccountStatus,
  FundsAccountType,
  FundsMovementType,
  InvoiceWorkflowStatus,
  MonthlyCloseStatus,
  PaymentApplicationType,
  PaymentDocumentType,
  PaymentEntity,
  PaymentFunction,
  PaymentMethodStatus,
  PaymentMethodType,
  PaymentStatus,
  StatementMovementDirection,
  StatementMovementStatus,
  UserRole,
  type AccountingInvoiceOrigin as AccountingInvoiceOriginType,
  type CashCountStatus as CashCountStatusType,
  type CashDestination as CashDestinationType,
  type CashReplenishmentStatus as CashReplenishmentStatusType,
  type CreditorStatus as CreditorStatusType,
  type CreditorType as CreditorTypeType,
  type CurrentExpenseStatus as CurrentExpenseStatusType,
  type ExpenseReceiptType as ExpenseReceiptTypeType,
  type FundsAccountStatus as FundsAccountStatusType,
  type FundsAccountType as FundsAccountTypeType,
  type FundsMovementType as FundsMovementTypeType,
  type InvoiceWorkflowStatus as InvoiceWorkflowStatusType,
  type MonthlyCloseStatus as MonthlyCloseStatusType,
  type PaymentApplicationType as PaymentApplicationTypeType,
  type PaymentDocumentType as PaymentDocumentTypeType,
  type PaymentEntity as PaymentEntityType,
  type PaymentFunction as PaymentFunctionType,
  type PaymentMethodStatus as PaymentMethodStatusType,
  type PaymentMethodType as PaymentMethodTypeType,
  type PaymentStatus as PaymentStatusType,
  type StatementMovementDirection as StatementMovementDirectionType,
  type StatementMovementStatus as StatementMovementStatusType,
  type UserRole as UserRoleType,
} from "@/generated/prisma/enums"

export {
  AccountingInvoiceOrigin,
  CashCountStatus,
  CashDestination,
  CashReplenishmentStatus,
  CreditorStatus,
  CreditorType,
  CurrentExpenseStatus,
  ExpenseReceiptType,
  FundsAccountStatus,
  FundsAccountType,
  FundsMovementType,
  InvoiceWorkflowStatus,
  MonthlyCloseStatus,
  PaymentApplicationType,
  PaymentDocumentType,
  PaymentEntity,
  PaymentFunction,
  PaymentMethodStatus,
  PaymentMethodType,
  PaymentStatus,
  StatementMovementDirection,
  StatementMovementStatus,
  UserRole,
}

export type DatabaseUserRole = UserRoleType
export type DatabasePaymentEntity = PaymentEntityType
export type DatabaseAccountingInvoiceOrigin = AccountingInvoiceOriginType
export type DatabasePaymentMethodType = PaymentMethodTypeType
export type DatabasePaymentMethodStatus = PaymentMethodStatusType
export type DatabaseFundsAccountType = FundsAccountTypeType
export type DatabaseFundsAccountStatus = FundsAccountStatusType
export type DatabaseCreditorType = CreditorTypeType
export type DatabaseCreditorStatus = CreditorStatusType
export type DatabasePaymentDocumentType = PaymentDocumentTypeType
export type DatabaseInvoiceWorkflowStatus = InvoiceWorkflowStatusType
export type DatabaseExpenseReceiptType = ExpenseReceiptTypeType
export type DatabaseCurrentExpenseStatus = CurrentExpenseStatusType
export type DatabasePaymentStatus = PaymentStatusType
export type DatabasePaymentApplicationType = PaymentApplicationTypeType
export type DatabasePaymentFunction = PaymentFunctionType
export type DatabaseFundsMovementType = FundsMovementTypeType
export type DatabaseStatementMovementDirection = StatementMovementDirectionType
export type DatabaseStatementMovementStatus = StatementMovementStatusType
export type DatabaseCashCountStatus = CashCountStatusType
export type DatabaseCashReplenishmentStatus = CashReplenishmentStatusType
export type DatabaseMonthlyCloseStatus = MonthlyCloseStatusType
export type DatabaseCashDestination = CashDestinationType

type EnumValue = string

export function databaseEnumSchema<T extends string>(parser: (value: string) => T | undefined) {
  return z.string().transform((value, context) => {
    const parsed = parser(value)
    if (!parsed) {
      context.addIssue({ code: "custom", message: "Valor no válido" })
      return z.NEVER
    }
    return parsed
  })
}

function normalizeValue<T extends EnumValue>(value: string | null | undefined, current: Record<string, T>, legacy: Record<string, T>) {
  if (!value) return undefined
  if (Object.values(current).includes(value as T)) return value as T
  return legacy[value]
}

export function parseUserRole(value: string | null | undefined): DatabaseUserRole | undefined {
  return normalizeValue(value, UserRole, { SOCIO: UserRole.PARTNER, EMPLEADO: UserRole.EMPLOYEE, OBRADOR: UserRole.BAKERY })
}

export function parsePaymentEntity(value: string | null | undefined): DatabasePaymentEntity | undefined {
  return normalizeValue(value, PaymentEntity, { OBRADOR: PaymentEntity.BAKERY, CAFETERIA: PaymentEntity.COFFEE_SHOP })
}

export function parsePaymentMethodType(value: string | null | undefined): DatabasePaymentMethodType | undefined {
  return normalizeValue(value, PaymentMethodType, {
    TRANSFERENCIA: PaymentMethodType.BANK_TRANSFER,
    DOMICILIACION: PaymentMethodType.DIRECT_DEBIT,
    TARJETA: PaymentMethodType.CARD,
    EFECTIVO: PaymentMethodType.CASH,
    CHEQUE: PaymentMethodType.CHECK,
    PAGO_MOVIL: PaymentMethodType.MOBILE_PAYMENT,
  })
}

export function parsePaymentMethodStatus(value: string | null | undefined): DatabasePaymentMethodStatus | undefined {
  return normalizeValue(value, PaymentMethodStatus, { ACTIVO: PaymentMethodStatus.ACTIVE, BAJA: PaymentMethodStatus.INACTIVE })
}

export function parseFundsAccountType(value: string | null | undefined): DatabaseFundsAccountType | undefined {
  return normalizeValue(value, FundsAccountType, { BANCO: FundsAccountType.BANK, CAJA: FundsAccountType.CASH_BOX, CAJA_CHICA: FundsAccountType.PETTY_CASH, TARJETA: FundsAccountType.CARD })
}

export function parseFundsAccountStatus(value: string | null | undefined): DatabaseFundsAccountStatus | undefined {
  return normalizeValue(value, FundsAccountStatus, { ACTIVA: FundsAccountStatus.ACTIVE, BLOQUEADA: FundsAccountStatus.BLOCKED, CERRADA: FundsAccountStatus.CLOSED })
}

export function parseCreditorType(value: string | null | undefined): DatabaseCreditorType | undefined {
  return normalizeValue(value, CreditorType, {
    PROVEEDOR_MERCANCIA: CreditorType.MERCHANDISE_SUPPLIER,
    SERVICIOS: CreditorType.SERVICES,
    PERSONAL: CreditorType.STAFF,
    ADMINISTRACION: CreditorType.ADMINISTRATION,
    OTROS: CreditorType.OTHER,
  })
}

export function parseCreditorStatus(value: string | null | undefined): DatabaseCreditorStatus | undefined {
  return normalizeValue(value, CreditorStatus, { ACTIVO: CreditorStatus.ACTIVE, BLOQUEADO: CreditorStatus.BLOCKED, BAJA: CreditorStatus.INACTIVE })
}

export function parsePaymentDocumentType(value: string | null | undefined): DatabasePaymentDocumentType | undefined {
  return normalizeValue(value, PaymentDocumentType, { COMPRA_MERCANCIA: PaymentDocumentType.MERCHANDISE_PURCHASE, GASTO: PaymentDocumentType.EXPENSE })
}

export function parseInvoiceWorkflowStatus(value: string | null | undefined): DatabaseInvoiceWorkflowStatus | undefined {
  return normalizeValue(value, InvoiceWorkflowStatus, {
    BORRADOR: InvoiceWorkflowStatus.DRAFT,
    EN_COTEJO: InvoiceWorkflowStatus.IN_REVIEW,
    INCIDENCIA: InvoiceWorkflowStatus.ISSUE,
    CONFORMADA: InvoiceWorkflowStatus.CONFIRMED,
    PARCIALMENTE_CONFORMADA: InvoiceWorkflowStatus.PARTIALLY_CONFIRMED,
    ANULADA: InvoiceWorkflowStatus.VOID,
  })
}

export function parseExpenseReceiptType(value: string | null | undefined): DatabaseExpenseReceiptType | undefined {
  return normalizeValue(value, ExpenseReceiptType, { FACTURA: ExpenseReceiptType.INVOICE, RECIBO: ExpenseReceiptType.RECEIPT, VALE_INTERNO: ExpenseReceiptType.INTERNAL_VOUCHER, SIN_JUSTIFICANTE: ExpenseReceiptType.NO_RECEIPT })
}

export function parseCurrentExpenseStatus(value: string | null | undefined): DatabaseCurrentExpenseStatus | undefined {
  return normalizeValue(value, CurrentExpenseStatus, {
    BORRADOR: CurrentExpenseStatus.DRAFT,
    PENDIENTE_AUTORIZACION: CurrentExpenseStatus.PENDING_AUTHORIZATION,
    AUTORIZADO: CurrentExpenseStatus.AUTHORIZED,
    RECHAZADO: CurrentExpenseStatus.REJECTED,
    PAGADO: CurrentExpenseStatus.PAID,
    CERRADO: CurrentExpenseStatus.CLOSED,
    ANULADO: CurrentExpenseStatus.VOID,
  })
}

export function parsePaymentStatus(value: string | null | undefined): DatabasePaymentStatus | undefined {
  return normalizeValue(value, PaymentStatus, { BORRADOR: PaymentStatus.DRAFT, PROGRAMADO: PaymentStatus.SCHEDULED, ORDENADO: PaymentStatus.ORDERED, CONCILIADO: PaymentStatus.RECONCILED, CERRADO: PaymentStatus.CLOSED, ANULADO: PaymentStatus.VOID })
}

export function parsePaymentApplicationType(value: string | null | undefined): DatabasePaymentApplicationType | undefined {
  return normalizeValue(value, PaymentApplicationType, { FACTURA: PaymentApplicationType.INVOICE, GASTO: PaymentApplicationType.EXPENSE, ANTICIPO: PaymentApplicationType.ADVANCE })
}

export function parsePaymentFunction(value: string | null | undefined): DatabasePaymentFunction | undefined {
  return normalizeValue(value, PaymentFunction, { REGISTRAR: PaymentFunction.REGISTER, SOLICITAR: PaymentFunction.REQUEST, AUTORIZAR: PaymentFunction.AUTHORIZE, EJECUTAR: PaymentFunction.EXECUTE, CONCILIAR: PaymentFunction.RECONCILE, ADMINISTRAR: PaymentFunction.ADMINISTER })
}

export function parseFundsMovementType(value: string | null | undefined): DatabaseFundsMovementType | undefined {
  return normalizeValue(value, FundsMovementType, { SALIDA_PAGO: FundsMovementType.PAYMENT_OUTFLOW, ENTRADA_DOTACION: FundsMovementType.ALLOCATION_INFLOW, REPOSICION_CAJA: FundsMovementType.CASH_REPLENISHMENT, DEPOSITO: FundsMovementType.DEPOSIT, AJUSTE: FundsMovementType.ADJUSTMENT, SALIDA_LEGACY: FundsMovementType.LEGACY_OUTFLOW })
}

export function parseStatementMovementDirection(value: string | null | undefined): DatabaseStatementMovementDirection | undefined {
  return normalizeValue(value, StatementMovementDirection, { ENTRADA: StatementMovementDirection.INFLOW, SALIDA: StatementMovementDirection.OUTFLOW })
}

export function parseStatementMovementStatus(value: string | null | undefined): DatabaseStatementMovementStatus | undefined {
  return normalizeValue(value, StatementMovementStatus, { PENDIENTE: StatementMovementStatus.PENDING, CONCILIADO: StatementMovementStatus.RECONCILED, INCIDENCIA: StatementMovementStatus.ISSUE })
}

export function parseCashCountStatus(value: string | null | undefined): DatabaseCashCountStatus | undefined {
  return normalizeValue(value, CashCountStatus, { BORRADOR: CashCountStatus.DRAFT, VALIDADO: CashCountStatus.VALIDATED, INCIDENCIA: CashCountStatus.ISSUE })
}

export function parseCashReplenishmentStatus(value: string | null | undefined): DatabaseCashReplenishmentStatus | undefined {
  return normalizeValue(value, CashReplenishmentStatus, { BORRADOR: CashReplenishmentStatus.DRAFT, SOLICITADA: CashReplenishmentStatus.REQUESTED, EJECUTADA: CashReplenishmentStatus.EXECUTED, RECHAZADA: CashReplenishmentStatus.REJECTED })
}

export function parseMonthlyCloseStatus(value: string | null | undefined): DatabaseMonthlyCloseStatus | undefined {
  return normalizeValue(value, MonthlyCloseStatus, { ABIERTO: MonthlyCloseStatus.OPEN, BLOQUEADO: MonthlyCloseStatus.BLOCKED, CERRADO: MonthlyCloseStatus.CLOSED })
}

export function parseCashDestination(value: string | null | undefined): DatabaseCashDestination | undefined {
  return normalizeValue(value, CashDestination, { DEPOSITO: CashDestination.DEPOSIT, INGRESO_EN_FONDO: CashDestination.FUND_REINVESTMENT, GUARDADO: CashDestination.STORED })
}

export const userRoleSchema = databaseEnumSchema(parseUserRole)
export const paymentEntitySchema = databaseEnumSchema(parsePaymentEntity)
export const paymentMethodTypeSchema = databaseEnumSchema(parsePaymentMethodType)
export const paymentMethodStatusSchema = databaseEnumSchema(parsePaymentMethodStatus)
export const fundsAccountTypeSchema = databaseEnumSchema(parseFundsAccountType)
export const fundsAccountStatusSchema = databaseEnumSchema(parseFundsAccountStatus)
export const creditorTypeSchema = databaseEnumSchema(parseCreditorType)
export const creditorStatusSchema = databaseEnumSchema(parseCreditorStatus)
export const paymentDocumentTypeSchema = databaseEnumSchema(parsePaymentDocumentType)
export const invoiceWorkflowStatusSchema = databaseEnumSchema(parseInvoiceWorkflowStatus)
export const expenseReceiptTypeSchema = databaseEnumSchema(parseExpenseReceiptType)
export const currentExpenseStatusSchema = databaseEnumSchema(parseCurrentExpenseStatus)
export const paymentStatusSchema = databaseEnumSchema(parsePaymentStatus)
export const paymentApplicationTypeSchema = databaseEnumSchema(parsePaymentApplicationType)
export const paymentFunctionSchema = databaseEnumSchema(parsePaymentFunction)
export const fundsMovementTypeSchema = databaseEnumSchema(parseFundsMovementType)
export const statementMovementDirectionSchema = databaseEnumSchema(parseStatementMovementDirection)
export const statementMovementStatusSchema = databaseEnumSchema(parseStatementMovementStatus)
export const cashCountStatusSchema = databaseEnumSchema(parseCashCountStatus)
export const cashReplenishmentStatusSchema = databaseEnumSchema(parseCashReplenishmentStatus)
export const monthlyCloseStatusSchema = databaseEnumSchema(parseMonthlyCloseStatus)
export const cashDestinationSchema = databaseEnumSchema(parseCashDestination)
