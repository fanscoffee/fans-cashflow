-- AlterTable
ALTER TABLE "Producto"
  ADD COLUMN "costeConIva" DECIMAL(10,4),
  ADD COLUMN "ivaCompraPct" DECIMAL(5,2),
  ADD COLUMN "ivaVentaPct" DECIMAL(5,2),
  ADD COLUMN "gananciaEurUd" DECIMAL(10,4);

-- Backfill the new fields from the existing single IVA and price fields.
UPDATE "Producto"
SET
  "ivaCompraPct" = "ivaPct",
  "ivaVentaPct" = "ivaPct",
  "costeConIva" = CASE
    WHEN "costeUmBase" IS NOT NULL AND "ivaPct" IS NOT NULL
      THEN ROUND("costeUmBase" * (1 + "ivaPct" / 100), 4)
    ELSE NULL
  END,
  "pvpAplicadoSinIva" = CASE
    WHEN "pvpAplicadoConIva" IS NOT NULL AND "ivaPct" IS NOT NULL AND "ivaPct" <> -100
      THEN ROUND("pvpAplicadoConIva" / (1 + "ivaPct" / 100), 4)
    ELSE NULL
  END,
  "gananciaEurUd" = CASE
    WHEN "costeUmBase" IS NOT NULL AND "pvpAplicadoConIva" IS NOT NULL AND "ivaPct" IS NOT NULL AND "ivaPct" <> -100
      THEN ROUND(("pvpAplicadoConIva" / (1 + "ivaPct" / 100)) - "costeUmBase", 4)
    ELSE NULL
  END,
  "margenRealPct" = CASE
    WHEN "costeUmBase" IS NOT NULL AND "pvpAplicadoConIva" IS NOT NULL AND "ivaPct" IS NOT NULL AND "ivaPct" <> -100
         AND ("pvpAplicadoConIva" / (1 + "ivaPct" / 100)) <> 0
      THEN ROUND((
        (("pvpAplicadoConIva" / (1 + "ivaPct" / 100)) - "costeUmBase")
        / ("pvpAplicadoConIva" / (1 + "ivaPct" / 100))
      ) * 100, 2)
    ELSE NULL
  END;
