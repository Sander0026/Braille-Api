-- Cria tabela dedicada para sessões de usuário e refresh token rotation por dispositivo.
-- As colunas legadas User.refreshToken e User.refreshTokenExpiraEm são mantidas nesta etapa
-- para evitar migração destrutiva e permitir transição segura.

CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ip" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");

ALTER TABLE "UserSession"
ADD CONSTRAINT "UserSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
