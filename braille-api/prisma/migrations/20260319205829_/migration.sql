/*
  Warnings:

  - You are about to drop the column `cpfRg` on the `Aluno` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rg]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CorRaca" AS ENUM ('BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_DECLARADO');

-- DropIndex
DROP INDEX "Aluno_cpfRg_idx";

-- DropIndex
DROP INDEX "Aluno_cpfRg_key";

-- AlterTable
ALTER TABLE "Aluno" DROP COLUMN "cpfRg",
ADD COLUMN     "atestadoEmitidoEm" TIMESTAMP(3),
ADD COLUMN     "atestadoUrl" TEXT,
ADD COLUMN     "corRaca" "CorRaca",
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "termoLgpdAceito" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termoLgpdAceitoEm" TIMESTAMP(3),
ADD COLUMN     "termoLgpdUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_cpf_key" ON "Aluno"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_rg_key" ON "Aluno"("rg");

-- CreateIndex
CREATE INDEX "Aluno_cpf_idx" ON "Aluno"("cpf");

-- CreateIndex
CREATE INDEX "Aluno_rg_idx" ON "Aluno"("rg");
