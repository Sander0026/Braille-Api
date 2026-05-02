/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "rua" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "uf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE INDEX "User_cpf_idx" ON "User"("cpf");
