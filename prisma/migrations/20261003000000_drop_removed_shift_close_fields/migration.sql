-- Remove fields no longer captured from shift closing tickets.
DROP INDEX "ShiftClose_pos_cashCloseNumber_key";

ALTER TABLE "ShiftClose"
  DROP COLUMN "pos",
  DROP COLUMN "previousCashFund",
  DROP COLUMN "cashReceipts",
  DROP COLUMN "cashRefunds",
  DROP COLUMN "depositedAmount",
  DROP COLUMN "paymentOutflows",
  DROP COLUMN "theoreticalCash",
  DROP COLUMN "actualCash",
  DROP COLUMN "cashVariance";
