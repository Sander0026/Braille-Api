ALTER TABLE "UserSession"
ADD COLUMN IF NOT EXISTS "previousRefreshTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "previousRotatedAt" TIMESTAMP(3);
