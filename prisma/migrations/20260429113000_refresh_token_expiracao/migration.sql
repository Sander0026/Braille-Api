-- Materializa a politica de expiracao de refresh token no banco.
ALTER TABLE "User"
  ADD COLUMN "refreshTokenExpiraEm" TIMESTAMP(3);

CREATE INDEX "User_refreshTokenExpiraEm_idx" ON "User"("refreshTokenExpiraEm");
