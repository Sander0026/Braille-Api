-- Adiciona a data de expiração do refresh token do usuário.
-- Necessário porque o AuthService grava User.refreshTokenExpiraEm no login/refresh.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "refreshTokenExpiraEm" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_refreshTokenExpiraEm_idx"
ON "User"("refreshTokenExpiraEm");
