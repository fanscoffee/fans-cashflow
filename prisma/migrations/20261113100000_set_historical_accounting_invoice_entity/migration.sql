-- Las capturas existentes antes de introducir la entidad pertenecen a Cafetería.
-- Las capturas nuevas mantienen Obrador como valor por defecto.
UPDATE "AccountingInvoice"
SET "entity" = 'CAFETERIA'
WHERE "entity" = 'OBRADOR'
  AND "createdAt" < TIMESTAMP '2026-11-13 00:00:00';
