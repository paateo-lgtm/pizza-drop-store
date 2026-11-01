-- Warteliste (Phase 7b): Austragen-Link je Eintrag. Die Tabelle ist vor Phase 7b
-- leer (keine Funktion schrieb hinein), daher NOT NULL ohne Vorgabewert.
-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_token_key" ON "WaitlistEntry"("token");

-- Indizes aus dem Code-Review vom 2026-11-01, Punkt 2.3
-- CreateIndex
CREATE INDEX "EmailLog_kind_createdAt_idx" ON "EmailLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Subscriber_status_confirmedAt_idx" ON "Subscriber"("status", "confirmedAt");
