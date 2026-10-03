-- Preserve historical ticket data while allowing new closes to omit removed fields.
ALTER TABLE "ShiftClose"
  ALTER COLUMN "pos" DROP NOT NULL,
  ALTER COLUMN "previousCashFund" DROP NOT NULL,
  ALTER COLUMN "cashReceipts" DROP NOT NULL,
  ALTER COLUMN "cashRefunds" DROP NOT NULL,
  ALTER COLUMN "depositedAmount" DROP NOT NULL,
  ALTER COLUMN "paymentOutflows" DROP NOT NULL,
  ALTER COLUMN "theoreticalCash" DROP NOT NULL,
  ALTER COLUMN "actualCash" DROP NOT NULL,
  ALTER COLUMN "cashVariance" DROP NOT NULL;
