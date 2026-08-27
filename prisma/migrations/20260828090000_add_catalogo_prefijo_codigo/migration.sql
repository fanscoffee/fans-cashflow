ALTER TABLE "Catalogo" ADD COLUMN "prefijoCodigo" TEXT;

UPDATE "Catalogo"
SET "prefijoCodigo" = CASE "valor"
  WHEN 'Harinas y sémolas' THEN 'HAR'
  WHEN 'Levaduras y mejorantes' THEN 'LEV'
  WHEN 'Azúcares y edulcorantes' THEN 'AZU'
  WHEN 'Grasas y aceites' THEN 'GRA'
  WHEN 'Lácteos y huevos' THEN 'LAC'
  WHEN 'Frutas y frutos secos' THEN 'FRU'
  WHEN 'Chocolates y coberturas' THEN 'CHO'
  WHEN 'Aditivos y aromas' THEN 'ADI'
  WHEN 'Sal y especias' THEN 'SAL'
  WHEN 'Envases y embalajes' THEN 'ENV'
  WHEN 'Consumibles y limpieza' THEN 'LIM'
  WHEN 'Pan' THEN 'PAN'
  WHEN 'Bollería' THEN 'BOL'
  WHEN 'Pastelería' THEN 'PAS'
  WHEN 'Tartas' THEN 'TAR'
  WHEN 'Salados' THEN 'SLD'
  WHEN 'Bebidas' THEN 'BEB'
  WHEN 'Cafetería' THEN 'CAF'
  WHEN 'Semielaborados' THEN 'SEM'
END
WHERE "tipo" = 'FAMILIA';

CREATE UNIQUE INDEX "Catalogo_prefijoCodigo_key" ON "Catalogo"("prefijoCodigo");
