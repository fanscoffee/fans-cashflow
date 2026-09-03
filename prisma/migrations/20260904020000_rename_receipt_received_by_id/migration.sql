-- Complete the Receipt identifier rename left out of the technical rename migration.
-- The column contains the same user references; only its identifier changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Receipt'
      AND column_name = 'recibidoById'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Receipt'
      AND column_name = 'receivedById'
  ) THEN
    ALTER TABLE "Receipt" RENAME COLUMN "recibidoById" TO "receivedById";
  END IF;
END $$;
