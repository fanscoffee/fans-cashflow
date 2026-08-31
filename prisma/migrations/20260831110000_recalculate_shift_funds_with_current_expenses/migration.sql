-- Recalcula los fondos de los turnos que ya tienen gastos corrientes vinculados.
UPDATE "Shift" AS s
SET "fondoFinal" = ROUND(
  s."fondoInicial"
  - COALESCE((
      SELECT SUM(e."importe")
      FROM "Expense" AS e
      WHERE e."shiftId" = s."id"
    ), 0)
  - COALESCE((
      SELECT SUM(g."importe")
      FROM "GastoCorriente" AS g
      WHERE g."shiftId" = s."id"
        AND g."estado" <> 'ANULADO'
    ), 0),
  2
)
WHERE EXISTS (
  SELECT 1
  FROM "GastoCorriente" AS g
  WHERE g."shiftId" = s."id"
);
