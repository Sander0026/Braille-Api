-- CreateEnum
CREATE TYPE "CorRaca" AS ENUM ('BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_DECLARADO');

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "atestadoEmitidoEm" TIMESTAMP(3),
ADD COLUMN     "atestadoUrl" TEXT,
ADD COLUMN     "corRaca" "CorRaca",
ADD COLUMN     "termoLgpdAceito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termoLgpdAceitoEm" TIMESTAMP(3),
ADD COLUMN     "termoLgpdUrl" TEXT;
