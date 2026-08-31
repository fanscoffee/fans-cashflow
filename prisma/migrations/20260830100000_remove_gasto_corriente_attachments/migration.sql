-- GastoCorriente no debe tener adjuntos almacenados.
ALTER TABLE "AdjuntoPago" DROP CONSTRAINT "AdjuntoPago_gastoId_fkey";
DROP INDEX "AdjuntoPago_gastoId_idx";
ALTER TABLE "AdjuntoPago" DROP COLUMN "gastoId";
