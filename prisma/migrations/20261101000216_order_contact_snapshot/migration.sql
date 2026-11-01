-- Kontaktdaten pro Bestellung festhalten. Bestehende Bestellungen übernehmen die Daten
-- ihres Kunden, danach werden die Spalten Pflicht.
ALTER TABLE "Order" ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT;

UPDATE "Order" o
SET "customerName" = c.name, "customerPhone" = COALESCE(c.phone, '')
FROM "Customer" c
WHERE c.id = o."customerId";

ALTER TABLE "Order" ALTER COLUMN "customerName" SET NOT NULL,
ALTER COLUMN "customerPhone" SET NOT NULL;
