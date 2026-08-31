-- Permite rastrear los gastos corrientes creados desde un turno abierto.
ALTER TABLE "GastoCorriente" ADD COLUMN "shiftId" TEXT;

CREATE INDEX "GastoCorriente_shiftId_idx" ON "GastoCorriente"("shiftId");

ALTER TABLE "GastoCorriente"
  ADD CONSTRAINT "GastoCorriente_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
