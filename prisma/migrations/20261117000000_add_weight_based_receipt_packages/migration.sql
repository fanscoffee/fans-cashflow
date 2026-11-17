-- Add weight-based product metadata and the physical package count per receipt line.
ALTER TABLE "Product" ADD COLUMN "isWeightBased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReceiptLine" ADD COLUMN "packageCount" INTEGER NOT NULL DEFAULT 1;
