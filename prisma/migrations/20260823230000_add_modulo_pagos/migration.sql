-- CreateEnum
CREATE TYPE "EntidadPago" AS ENUM ('OBRADOR', 'CAFETERIA');

-- CreateEnum
CREATE TYPE "TipoMedioPago" AS ENUM ('TRANSFERENCIA', 'DOMICILIACION', 'TARJETA', 'EFECTIVO', 'CHEQUE', 'PAGO_MOVIL');

-- CreateEnum
CREATE TYPE "EstadoMedioPago" AS ENUM ('ACTIVO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoCuentaFondos" AS ENUM ('BANCO', 'CAJA', 'CAJA_CHICA', 'TARJETA');

-- CreateEnum
CREATE TYPE "EstadoCuentaFondos" AS ENUM ('ACTIVA', 'BLOQUEADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoAcreedor" AS ENUM ('PROVEEDOR_MERCANCIA', 'SERVICIOS', 'PERSONAL', 'ADMINISTRACION', 'OTROS');

-- CreateEnum
CREATE TYPE "EstadoAcreedor" AS ENUM ('ACTIVO', 'BLOQUEADO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoDocumentoPago" AS ENUM ('COMPRA_MERCANCIA', 'GASTO');

-- CreateEnum
CREATE TYPE "EstadoCircuitoFactura" AS ENUM ('BORRADOR', 'EN_COTEJO', 'INCIDENCIA', 'CONFORMADA', 'PARCIALMENTE_CONFORMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "JustificanteGasto" AS ENUM ('FACTURA', 'RECIBO', 'TICKET', 'CONTRATO', 'VALE_INTERNO', 'SIN_JUSTIFICANTE');

-- CreateEnum
CREATE TYPE "EstadoGastoCorriente" AS ENUM ('BORRADOR', 'PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'RECHAZADO', 'PAGADO', 'CERRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('BORRADOR', 'PROGRAMADO', 'ORDENADO', 'CONCILIADO', 'CERRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoAplicacionPago" AS ENUM ('FACTURA', 'GASTO', 'ANTICIPO');

-- CreateEnum
CREATE TYPE "FuncionPago" AS ENUM ('REGISTRAR', 'SOLICITAR', 'AUTORIZAR', 'EJECUTAR', 'CONCILIAR', 'ADMINISTRAR');

-- CreateEnum
CREATE TYPE "TipoMovimientoFondos" AS ENUM ('SALIDA_PAGO', 'ENTRADA_DOTACION', 'REPOSICION_CAJA', 'DEPOSITO', 'AJUSTE', 'SALIDA_LEGACY');

-- CreateEnum
CREATE TYPE "DireccionMovimientoExtracto" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "EstadoMovimientoExtracto" AS ENUM ('PENDIENTE', 'CONCILIADO', 'INCIDENCIA');

-- CreateEnum
CREATE TYPE "EstadoArqueoCaja" AS ENUM ('BORRADOR', 'VALIDADO', 'INCIDENCIA');

-- CreateEnum
CREATE TYPE "EstadoReposicionCaja" AS ENUM ('BORRADOR', 'SOLICITADA', 'EJECUTADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoCierreMensual" AS ENUM ('ABIERTO', 'BLOQUEADO', 'CERRADO');

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "acreedorId" TEXT,
ADD COLUMN     "entidad" "EntidadPago" NOT NULL DEFAULT 'OBRADOR',
ADD COLUMN     "esLegacyPago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estadoCircuito" "EstadoCircuitoFactura" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN     "importeConformado" DECIMAL(12,2),
ADD COLUMN     "importeRetenido" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "motivoRetencion" TEXT,
ADD COLUMN     "referenciaOrigen" TEXT,
ADD COLUMN     "tipoDocumento" "TipoDocumentoPago" NOT NULL DEFAULT 'COMPRA_MERCANCIA';

-- CreateTable
CREATE TABLE "Acreedor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoAcreedor" NOT NULL,
    "nombre" TEXT NOT NULL,
    "nif" TEXT,
    "entidadHabitual" "EntidadPago",
    "cuentaDestinoUltimos4" VARCHAR(4),
    "estado" "EstadoAcreedor" NOT NULL DEFAULT 'ACTIVO',
    "proveedorId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acreedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedioPago" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMedioPago" NOT NULL,
    "requiereCuenta" BOOLEAN NOT NULL DEFAULT true,
    "conciliableBanco" BOOLEAN NOT NULL DEFAULT true,
    "limiteOperacion" DECIMAL(12,2),
    "estado" "EstadoMedioPago" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedioPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaFondos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCuentaFondos" NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ibanUltimos4" VARCHAR(4),
    "responsableId" TEXT NOT NULL,
    "saldoTeorico" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fondoFijo" DECIMAL(12,2),
    "estado" "EstadoCuentaFondos" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaFondos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroAutorizacion" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago",
    "codigo" TEXT NOT NULL,
    "valorDecimal" DECIMAL(12,2),
    "valorTexto" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroAutorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaAutorizacion" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago",
    "importeDesde" DECIMAL(12,2) NOT NULL,
    "importeHasta" DECIMAL(12,2),
    "funcionRequerida" "FuncionPago" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReglaAutorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionPagoUsuario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entidad" "EntidadPago",
    "funcion" "FuncionPago" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsignacionPagoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoRecurrente" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "acreedorId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "importeEsperado" DECIMAL(12,2) NOT NULL,
    "tolerancia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "periodicidad" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "autorizadoPorId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoCorriente" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "acreedorId" TEXT,
    "contratoId" TEXT,
    "concepto" TEXT NOT NULL,
    "fechaDevengo" DATE NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "justificante" "JustificanteGasto" NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "autorizadorId" TEXT,
    "estado" "EstadoGastoCorriente" NOT NULL DEFAULT 'BORRADOR',
    "motivoRechazo" TEXT,
    "autorizadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoCorriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anticipo" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "acreedorId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "importeAplicado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "solicitadoPorId" TEXT NOT NULL,
    "autorizadoPorId" TEXT,
    "estado" "EstadoGastoCorriente" NOT NULL DEFAULT 'PENDIENTE_AUTORIZACION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anticipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuenciaPago" (
    "entidad" "EntidadPago" NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuenciaPago_pkey" PRIMARY KEY ("entidad")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "fechaPago" DATE NOT NULL,
    "medioPagoId" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "acreedorId" TEXT NOT NULL,
    "importeTotal" DECIMAL(12,2) NOT NULL,
    "referenciaExterna" TEXT,
    "ejecutadoPorId" TEXT NOT NULL,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPago" NOT NULL DEFAULT 'BORRADOR',
    "excesoAutorizadoPorId" TEXT,
    "motivoExceso" TEXT,
    "anuladoPorId" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoAplicacion" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "tipoDestino" "TipoAplicacionPago" NOT NULL,
    "facturaId" TEXT,
    "gastoId" TEXT,
    "anticipoId" TEXT,
    "importeAplicado" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoAplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AprobacionPago" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AprobacionPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoFondos" (
    "id" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "tipo" "TipoMovimientoFondos" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "descripcion" TEXT,
    "origenTipo" TEXT,
    "origenId" TEXT,
    "pagoId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoFondos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacionExtracto" (
    "id" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "hashArchivo" TEXT,
    "fechaDesde" DATE,
    "fechaHasta" DATE,
    "creadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacionExtracto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoExtracto" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "fechaValor" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "direccion" "DireccionMovimientoExtracto" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoMovimientoExtracto" NOT NULL DEFAULT 'PENDIENTE',
    "pagoId" TEXT,
    "conciliadoPorId" TEXT,
    "conciliadoAt" TIMESTAMP(3),
    "incidencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoExtracto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArqueoCaja" (
    "id" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "custodioId" TEXT NOT NULL,
    "verificadorId" TEXT NOT NULL,
    "efectivoContado" DECIMAL(12,2) NOT NULL,
    "justificantes" DECIMAL(12,2) NOT NULL,
    "fondoFijo" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoArqueoCaja" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArqueoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReposicionCaja" (
    "id" TEXT NOT NULL,
    "cuentaFondosId" TEXT NOT NULL,
    "arqueoId" TEXT,
    "importe" DECIMAL(12,2) NOT NULL,
    "importeJustificado" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoReposicionCaja" NOT NULL DEFAULT 'BORRADOR',
    "creadaPorId" TEXT NOT NULL,
    "ejecutadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReposicionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioCuentaAcreedor" (
    "id" TEXT NOT NULL,
    "acreedorId" TEXT NOT NULL,
    "cuentaAnterior4" TEXT,
    "cuentaNueva4" VARCHAR(4) NOT NULL,
    "motivo" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "autorizadoPorId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "confirmacionCanal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorizadoAt" TIMESTAMP(3),

    CONSTRAINT "CambioCuentaAcreedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjuntoPago" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "sha256" TEXT,
    "facturaId" TEXT,
    "gastoId" TEXT,
    "subidoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjuntoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreMensual" (
    "id" TEXT NOT NULL,
    "entidad" "EntidadPago" NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" "EstadoCierreMensual" NOT NULL DEFAULT 'ABIERTO',
    "cerradoPorId" TEXT,
    "cerradoAt" TIMESTAMP(3),
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CierreMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicadorCierre" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cantidad" DECIMAL(14,2),
    "importe" DECIMAL(14,2),
    "porcentaje" DECIMAL(7,4),
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicadorCierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAuditoria" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "accion" TEXT NOT NULL,
    "tipoRegistro" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "entidad" "EntidadPago",
    "motivo" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Acreedor_codigo_key" ON "Acreedor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Acreedor_proveedorId_key" ON "Acreedor"("proveedorId");

-- CreateIndex
CREATE INDEX "Acreedor_tipo_estado_idx" ON "Acreedor"("tipo", "estado");

-- CreateIndex
CREATE INDEX "Acreedor_nif_idx" ON "Acreedor"("nif");

-- CreateIndex
CREATE INDEX "MedioPago_tipo_estado_idx" ON "MedioPago"("tipo", "estado");

-- CreateIndex
CREATE INDEX "CuentaFondos_entidad_tipo_estado_idx" ON "CuentaFondos"("entidad", "tipo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaGasto_codigo_key" ON "CategoriaGasto"("codigo");

-- CreateIndex
CREATE INDEX "ParametroAutorizacion_codigo_activo_idx" ON "ParametroAutorizacion"("codigo", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroAutorizacion_entidad_codigo_version_key" ON "ParametroAutorizacion"("entidad", "codigo", "version");

-- CreateIndex
CREATE INDEX "ReglaAutorizacion_entidad_importeDesde_importeHasta_activo_idx" ON "ReglaAutorizacion"("entidad", "importeDesde", "importeHasta", "activo");

-- CreateIndex
CREATE INDEX "AsignacionPagoUsuario_userId_funcion_activo_idx" ON "AsignacionPagoUsuario"("userId", "funcion", "activo");

-- CreateIndex
CREATE INDEX "AsignacionPagoUsuario_entidad_funcion_activo_idx" ON "AsignacionPagoUsuario"("entidad", "funcion", "activo");

-- CreateIndex
CREATE INDEX "ContratoRecurrente_entidad_activo_fechaInicio_idx" ON "ContratoRecurrente"("entidad", "activo", "fechaInicio");

-- CreateIndex
CREATE INDEX "GastoCorriente_entidad_estado_fechaDevengo_idx" ON "GastoCorriente"("entidad", "estado", "fechaDevengo");

-- CreateIndex
CREATE INDEX "GastoCorriente_acreedorId_categoriaId_fechaDevengo_idx" ON "GastoCorriente"("acreedorId", "categoriaId", "fechaDevengo");

-- CreateIndex
CREATE INDEX "Anticipo_entidad_estado_fecha_idx" ON "Anticipo"("entidad", "estado", "fecha");

-- CreateIndex
CREATE INDEX "Pago_entidad_estado_fechaPago_idx" ON "Pago"("entidad", "estado", "fechaPago");

-- CreateIndex
CREATE INDEX "Pago_acreedorId_estado_idx" ON "Pago"("acreedorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_entidad_numero_key" ON "Pago"("entidad", "numero");

-- CreateIndex
CREATE INDEX "PagoAplicacion_facturaId_idx" ON "PagoAplicacion"("facturaId");

-- CreateIndex
CREATE INDEX "PagoAplicacion_gastoId_idx" ON "PagoAplicacion"("gastoId");

-- CreateIndex
CREATE INDEX "PagoAplicacion_anticipoId_idx" ON "PagoAplicacion"("anticipoId");

-- CreateIndex
CREATE INDEX "AprobacionPago_pagoId_tipo_idx" ON "AprobacionPago"("pagoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoFondos_pagoId_key" ON "MovimientoFondos"("pagoId");

-- CreateIndex
CREATE INDEX "MovimientoFondos_cuentaFondosId_createdAt_idx" ON "MovimientoFondos"("cuentaFondosId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoFondos_entidad_tipo_createdAt_idx" ON "MovimientoFondos"("entidad", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "ImportacionExtracto_cuentaFondosId_createdAt_idx" ON "ImportacionExtracto"("cuentaFondosId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoExtracto_pagoId_key" ON "MovimientoExtracto"("pagoId");

-- CreateIndex
CREATE INDEX "MovimientoExtracto_cuentaFondosId_fechaValor_estado_idx" ON "MovimientoExtracto"("cuentaFondosId", "fechaValor", "estado");

-- CreateIndex
CREATE INDEX "MovimientoExtracto_referenciaExterna_idx" ON "MovimientoExtracto"("referenciaExterna");

-- CreateIndex
CREATE INDEX "ArqueoCaja_cuentaFondosId_fecha_idx" ON "ArqueoCaja"("cuentaFondosId", "fecha");

-- CreateIndex
CREATE INDEX "ReposicionCaja_cuentaFondosId_estado_createdAt_idx" ON "ReposicionCaja"("cuentaFondosId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "CambioCuentaAcreedor_acreedorId_estado_idx" ON "CambioCuentaAcreedor"("acreedorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "AdjuntoPago_storageKey_key" ON "AdjuntoPago"("storageKey");

-- CreateIndex
CREATE INDEX "AdjuntoPago_facturaId_idx" ON "AdjuntoPago"("facturaId");

-- CreateIndex
CREATE INDEX "AdjuntoPago_gastoId_idx" ON "AdjuntoPago"("gastoId");

-- CreateIndex
CREATE INDEX "CierreMensual_estado_anio_mes_idx" ON "CierreMensual"("estado", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "CierreMensual_entidad_anio_mes_key" ON "CierreMensual"("entidad", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorCierre_cierreId_codigo_key" ON "IndicadorCierre"("cierreId", "codigo");

-- CreateIndex
CREATE INDEX "EventoAuditoria_tipoRegistro_registroId_createdAt_idx" ON "EventoAuditoria"("tipoRegistro", "registroId", "createdAt");

-- CreateIndex
CREATE INDEX "EventoAuditoria_entidad_createdAt_idx" ON "EventoAuditoria"("entidad", "createdAt");

-- Domain invariants not expressible in the Prisma schema.
ALTER TABLE "PagoAplicacion"
  ADD CONSTRAINT "PagoAplicacion_one_target_chk"
  CHECK (num_nonnulls("facturaId", "gastoId", "anticipoId") = 1);

ALTER TABLE "PagoAplicacion"
  ADD CONSTRAINT "PagoAplicacion_positive_amount_chk"
  CHECK ("importeAplicado" > 0);

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_positive_amount_chk"
  CHECK ("importeTotal" > 0);

ALTER TABLE "GastoCorriente"
  ADD CONSTRAINT "GastoCorriente_positive_amount_chk"
  CHECK ("importe" > 0);

ALTER TABLE "AdjuntoPago"
  ADD CONSTRAINT "AdjuntoPago_one_document_chk"
  CHECK (num_nonnulls("facturaId", "gastoId") = 1);

ALTER TABLE "CuentaFondos"
  ADD CONSTRAINT "CuentaFondos_cash_fund_chk"
  CHECK (("tipo" = 'CAJA_CHICA' AND "fondoFijo" IS NOT NULL AND "fondoFijo" >= 0)
      OR ("tipo" <> 'CAJA_CHICA' AND "fondoFijo" IS NULL));

-- CreateIndex
CREATE INDEX "Factura_entidad_estadoCircuito_fechaVencimiento_idx" ON "Factura"("entidad", "estadoCircuito", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "Factura_acreedorId_estadoCircuito_idx" ON "Factura"("acreedorId", "estadoCircuito");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_acreedorId_numero_key" ON "Factura"("acreedorId", "numero");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acreedor" ADD CONSTRAINT "Acreedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acreedor" ADD CONSTRAINT "Acreedor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaFondos" ADD CONSTRAINT "CuentaFondos_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroAutorizacion" ADD CONSTRAINT "ParametroAutorizacion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaAutorizacion" ADD CONSTRAINT "ReglaAutorizacion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPagoUsuario" ADD CONSTRAINT "AsignacionPagoUsuario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoRecurrente" ADD CONSTRAINT "ContratoRecurrente_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoRecurrente" ADD CONSTRAINT "ContratoRecurrente_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoRecurrente" ADD CONSTRAINT "ContratoRecurrente_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCorriente" ADD CONSTRAINT "GastoCorriente_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCorriente" ADD CONSTRAINT "GastoCorriente_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCorriente" ADD CONSTRAINT "GastoCorriente_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoRecurrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCorriente" ADD CONSTRAINT "GastoCorriente_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCorriente" ADD CONSTRAINT "GastoCorriente_autorizadorId_fkey" FOREIGN KEY ("autorizadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_medioPagoId_fkey" FOREIGN KEY ("medioPagoId") REFERENCES "MedioPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_ejecutadoPorId_fkey" FOREIGN KEY ("ejecutadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_excesoAutorizadoPorId_fkey" FOREIGN KEY ("excesoAutorizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "GastoCorriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoAplicacion" ADD CONSTRAINT "PagoAplicacion_anticipoId_fkey" FOREIGN KEY ("anticipoId") REFERENCES "Anticipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprobacionPago" ADD CONSTRAINT "AprobacionPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprobacionPago" ADD CONSTRAINT "AprobacionPago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacionExtracto" ADD CONSTRAINT "ImportacionExtracto_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacionExtracto" ADD CONSTRAINT "ImportacionExtracto_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoExtracto" ADD CONSTRAINT "MovimientoExtracto_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "ImportacionExtracto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoExtracto" ADD CONSTRAINT "MovimientoExtracto_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoExtracto" ADD CONSTRAINT "MovimientoExtracto_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoExtracto" ADD CONSTRAINT "MovimientoExtracto_conciliadoPorId_fkey" FOREIGN KEY ("conciliadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoCaja" ADD CONSTRAINT "ArqueoCaja_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoCaja" ADD CONSTRAINT "ArqueoCaja_custodioId_fkey" FOREIGN KEY ("custodioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoCaja" ADD CONSTRAINT "ArqueoCaja_verificadorId_fkey" FOREIGN KEY ("verificadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReposicionCaja" ADD CONSTRAINT "ReposicionCaja_cuentaFondosId_fkey" FOREIGN KEY ("cuentaFondosId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReposicionCaja" ADD CONSTRAINT "ReposicionCaja_arqueoId_fkey" FOREIGN KEY ("arqueoId") REFERENCES "ArqueoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReposicionCaja" ADD CONSTRAINT "ReposicionCaja_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioCuentaAcreedor" ADD CONSTRAINT "CambioCuentaAcreedor_acreedorId_fkey" FOREIGN KEY ("acreedorId") REFERENCES "Acreedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioCuentaAcreedor" ADD CONSTRAINT "CambioCuentaAcreedor_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioCuentaAcreedor" ADD CONSTRAINT "CambioCuentaAcreedor_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjuntoPago" ADD CONSTRAINT "AdjuntoPago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjuntoPago" ADD CONSTRAINT "AdjuntoPago_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "GastoCorriente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjuntoPago" ADD CONSTRAINT "AdjuntoPago_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreMensual" ADD CONSTRAINT "CierreMensual_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicadorCierre" ADD CONSTRAINT "IndicadorCierre_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "CierreMensual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
