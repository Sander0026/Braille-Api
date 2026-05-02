-- Guarda o refresh token imediatamente anterior para diferenciar:
-- 1. refresh token aleatorio/invalido: retorna 401 sem revogar a sessao;
-- 2. refresh token anterior reutilizado: revoga a sessao por seguranca.

ALTER TABLE "UserSession"
ADD COLUMN IF NOT EXISTS "previousRefreshTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "previousRotatedAt" TIMESTAMP(3);
