/*
  Warnings:

  - You are about to drop the column `cpfRg` on the `Aluno` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rg]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.

  Note: CorRaca enum and LGPD columns were already created in migration 20260318122137_add_lgpd_atestado.
  This migration only handles the cpfRg -> cpf/rg split.
*/

-- DropIndex
DROP INDEX IF EXISTS "Aluno_cpfRg_idx";

-- DropIndex
DROP INDEX IF EXISTS "Aluno_cpfRg_key";

-- AlterTable: drop cpfRg, add cpf and rg (LGPD columns already exist from 20260318122137)
ALTER TABLE "Aluno"
  DROP COLUMN IF EXISTS "cpfRg",
  ADD COLUMN IF NOT EXISTS "cpf" TEXT,
  ADD COLUMN IF NOT EXISTS "rg" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Aluno_cpf_key" ON "Aluno"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Aluno_rg_key" ON "Aluno"("rg");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Aluno_cpf_idx" ON "Aluno"("cpf");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Aluno_rg_idx" ON "Aluno"("rg");
