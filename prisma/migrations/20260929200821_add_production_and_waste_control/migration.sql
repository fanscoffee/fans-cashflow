-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('SALDO_INICIAL', 'RECEPCION', 'PRODUCCION', 'MERMA', 'AJUSTE_INVENTARIO_FISICO', 'REVERSA');

-- CreateEnum
CREATE TYPE "RecipeVersionStatus" AS ENUM ('BORRADOR', 'VIGENTE', 'SUSTITUIDA');

-- CreateEnum
CREATE TYPE "OperationalRecordStatus" AS ENUM ('CONTABILIZADO', 'REVISION_REQUERIDA', 'APROBADO', 'REVERSADO');

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" "PaymentEntity" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "locationId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RecipeVersionStatus" NOT NULL DEFAULT 'BORRADOR',
    "tolerancePercentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeComponent" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(14,6) NOT NULL,

    CONSTRAINT "RecipeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionEntry" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recipeVersionId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "exceptionReason" TEXT,
    "deviationReason" TEXT,
    "standaloneReason" TEXT,
    "status" "OperationalRecordStatus" NOT NULL DEFAULT 'CONTABILIZADO',
    "inventoryTransactionId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionConsumption" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "theoreticalQuantity" DECIMAL(14,6) NOT NULL,
    "actualQuantity" DECIMAL(14,6) NOT NULL,
    "exceedsTolerance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductionConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteReason" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteEntry" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "standaloneReason" TEXT,
    "status" "OperationalRecordStatus" NOT NULL DEFAULT 'CONTABILIZADO',
    "inventoryTransactionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftOperationalReview" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "productionReviewed" BOOLEAN NOT NULL,
    "wasteReviewed" BOOLEAN NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftOperationalReview_pkey" PRIMARY KEY ("id")
);

-- Domain constraints
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_quantity_nonzero" CHECK ("quantity" <> 0);

ALTER TABLE "RecipeVersion"
  ADD CONSTRAINT "RecipeVersion_tolerance_range" CHECK ("tolerancePercentage" >= 0 AND "tolerancePercentage" <= 100),
  ADD CONSTRAINT "RecipeVersion_effective_dates" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "RecipeComponent"
  ADD CONSTRAINT "RecipeComponent_quantity_positive" CHECK ("quantityPerUnit" > 0);

ALTER TABLE "ProductionEntry"
  ADD CONSTRAINT "ProductionEntry_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "ProductionEntry_standalone_reason" CHECK ("shiftId" IS NOT NULL OR length(trim("standaloneReason")) > 0);

ALTER TABLE "ProductionConsumption"
  ADD CONSTRAINT "ProductionConsumption_quantities_nonnegative" CHECK ("theoreticalQuantity" >= 0 AND "actualQuantity" >= 0);

ALTER TABLE "WasteEntry"
  ADD CONSTRAINT "WasteEntry_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "WasteEntry_standalone_reason" CHECK ("shiftId" IS NOT NULL OR length(trim("standaloneReason")) > 0);

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_code_key" ON "StockLocation"("code");

-- CreateIndex
CREATE INDEX "StockLocation_entity_active_idx" ON "StockLocation"("entity", "active");

-- CreateIndex
CREATE INDEX "InventoryBalance_productId_idx" ON "InventoryBalance"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_locationId_productId_key" ON "InventoryBalance"("locationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_reversalOfId_key" ON "InventoryTransaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_locationId_effectiveAt_idx" ON "InventoryTransaction"("locationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdById_createdAt_idx" ON "InventoryTransaction"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_effectiveAt_idx" ON "InventoryTransaction"("type", "effectiveAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_transactionId_productId_key" ON "InventoryMovement"("transactionId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE INDEX "RecipeVersion_recipeId_status_idx" ON "RecipeVersion"("recipeId", "status");

-- Only one recipe version can be active for a product at a time.
CREATE UNIQUE INDEX "RecipeVersion_one_active_per_recipe" ON "RecipeVersion"("recipeId") WHERE "status" = 'VIGENTE';

-- CreateIndex
CREATE INDEX "RecipeVersion_createdById_idx" ON "RecipeVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_version_key" ON "RecipeVersion"("recipeId", "version");

-- CreateIndex
CREATE INDEX "RecipeComponent_componentProductId_idx" ON "RecipeComponent"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeComponent_recipeVersionId_componentProductId_key" ON "RecipeComponent"("recipeVersionId", "componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEntry_inventoryTransactionId_key" ON "ProductionEntry"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "ProductionEntry_shiftId_createdAt_idx" ON "ProductionEntry"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionEntry_locationId_effectiveAt_idx" ON "ProductionEntry"("locationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "ProductionEntry_productId_effectiveAt_idx" ON "ProductionEntry"("productId", "effectiveAt");

-- CreateIndex
CREATE INDEX "ProductionEntry_status_effectiveAt_idx" ON "ProductionEntry"("status", "effectiveAt");

-- CreateIndex
CREATE INDEX "ProductionEntry_createdById_idx" ON "ProductionEntry"("createdById");

-- CreateIndex
CREATE INDEX "ProductionEntry_approvedById_idx" ON "ProductionEntry"("approvedById");

-- CreateIndex
CREATE INDEX "ProductionEntry_reversedById_idx" ON "ProductionEntry"("reversedById");

-- CreateIndex
CREATE INDEX "ProductionConsumption_componentProductId_idx" ON "ProductionConsumption"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionConsumption_productionId_componentProductId_key" ON "ProductionConsumption"("productionId", "componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "WasteReason_code_key" ON "WasteReason"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WasteEntry_inventoryTransactionId_key" ON "WasteEntry"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "WasteEntry_shiftId_createdAt_idx" ON "WasteEntry"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "WasteEntry_locationId_effectiveAt_idx" ON "WasteEntry"("locationId", "effectiveAt");

-- CreateIndex
CREATE INDEX "WasteEntry_productId_effectiveAt_idx" ON "WasteEntry"("productId", "effectiveAt");

-- CreateIndex
CREATE INDEX "WasteEntry_reasonId_effectiveAt_idx" ON "WasteEntry"("reasonId", "effectiveAt");

-- CreateIndex
CREATE INDEX "WasteEntry_createdById_idx" ON "WasteEntry"("createdById");

-- CreateIndex
CREATE INDEX "WasteEntry_reversedById_idx" ON "WasteEntry"("reversedById");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOperationalReview_shiftId_key" ON "ShiftOperationalReview"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftOperationalReview_confirmedById_idx" ON "ShiftOperationalReview"("confirmedById");

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InventoryTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComponent" ADD CONSTRAINT "RecipeComponent_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComponent" ADD CONSTRAINT "RecipeComponent_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "ProductionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "WasteReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOperationalReview" ADD CONSTRAINT "ShiftOperationalReview_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOperationalReview" ADD CONSTRAINT "ShiftOperationalReview_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Initial locations and administrable waste reasons.
INSERT INTO "StockLocation" ("id", "code", "name", "entity", "active", "createdAt", "updatedAt") VALUES
  ('stock-location-cafeteria', 'CAFETERIA', 'Cafetería', 'CAFETERIA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stock-location-obrador', 'OBRADOR', 'Obrador', 'OBRADOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "WasteReason" ("id", "code", "name", "description", "active", "createdAt", "updatedAt") VALUES
  ('waste-reason-expiry', 'VENCIMIENTO', 'Vencimiento', 'Producto vencido o fuera de fecha', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('waste-reason-failed-production', 'ELABORACION_FALLIDA', 'Elaboración fallida', 'Pérdida producida durante una elaboración', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('waste-reason-damage', 'DANO', 'Daño', 'Producto o insumo dañado', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('waste-reason-leftover', 'SOBRANTE_NO_REUTILIZABLE', 'Sobrante no reutilizable', 'Sobrante que no puede conservarse ni reutilizarse', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('waste-reason-internal-use', 'CONSUMO_INTERNO', 'Consumo interno', 'Consumo no destinado a venta', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('waste-reason-other', 'OTRO', 'Otro', 'Requiere una observación descriptiva', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- These tables are server-only. Direct Data API roles receive no policies.
ALTER TABLE "StockLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionConsumption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WasteReason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WasteEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftOperationalReview" ENABLE ROW LEVEL SECURITY;
