/*
  Warnings:

  - You are about to drop the column `cpfRg` on the `Aluno` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rg]` on the table `Aluno` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Aluno_cpfRg_idx";

-- DropIndex
DROP INDEX "Aluno_cpfRg_key";

-- AlterTable
ALTER TABLE "Aluno" DROP COLUMN "cpfRg",
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "rg" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_cpf_key" ON "Aluno"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_rg_key" ON "Aluno"("rg");

-- CreateIndex
CREATE INDEX "Aluno_cpf_idx" ON "Aluno"("cpf");

-- CreateIndex
CREATE INDEX "Aluno_rg_idx" ON "Aluno"("rg");
