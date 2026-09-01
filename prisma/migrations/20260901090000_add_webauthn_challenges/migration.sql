-- CreateTable
CREATE TABLE "WebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedUserId" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_purpose_expiresAt_consumedAt_idx" ON "WebAuthnChallenge"("purpose", "expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "WebAuthnChallenge_userId_purpose_consumedAt_idx" ON "WebAuthnChallenge"("userId", "purpose", "consumedAt");

-- AddForeignKey
ALTER TABLE "WebAuthnChallenge" ADD CONSTRAINT "WebAuthnChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent duplicate shifts when concurrent requests pass the application check.
CREATE UNIQUE INDEX "Shift_date_turno_key" ON "Shift"("date", "turno");

-- The application permits only one open shift at a time.
CREATE UNIQUE INDEX "Shift_one_open_key" ON "Shift"("status") WHERE "status" = 'ABIERTO';

-- Incremented when a password or account credential is reset, invalidating old JWTs.
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

-- A validated cash count can back at most one executed replenishment.
CREATE UNIQUE INDEX "ReposicionCaja_arqueoId_key" ON "ReposicionCaja"("arqueoId");

-- Prevent the same normalized bank statement from being imported twice for one account.
CREATE UNIQUE INDEX "ImportacionExtracto_cuentaFondosId_hashArchivo_key"
    ON "ImportacionExtracto"("cuentaFondosId", "hashArchivo")
    WHERE "hashArchivo" IS NOT NULL;
