BEGIN;

ALTER TABLE "ReceiptLine"
  ADD COLUMN "genericDescription" TEXT,
  ADD COLUMN "genericVatPercentage" DECIMAL(7, 4),
  ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_catalog_or_generic_check" CHECK (
  ("productId" IS NOT NULL AND "genericDescription" IS NULL AND "genericVatPercentage" IS NULL)
  OR
  ("productId" IS NULL
    AND "genericDescription" IS NOT NULL
    AND "genericDescription" ~ '[^[:space:]]'
    AND char_length("genericDescription") <= 500
    AND "genericVatPercentage" IS NOT NULL
    AND "genericVatPercentage" BETWEEN 0 AND 100)
);

-- The application accesses receipt lines through authenticated server routes, not the Data API.
ALTER TABLE "ReceiptLine" ENABLE ROW LEVEL SECURITY;

COMMIT;
