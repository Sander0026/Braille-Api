-- CreateEnum
CREATE TYPE "StatusFrequencia" AS ENUM ('PRESENTE', 'FALTA', 'FALTA_JUSTIFICADA');

-- AlterTable
ALTER TABLE "Frequencia" ADD COLUMN     "justificativaId" TEXT,
ADD COLUMN     "status" "StatusFrequencia" NOT NULL DEFAULT 'FALTA';

-- CreateTable
CREATE TABLE "Atestado" (
    "id" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "Atestado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Atestado_alunoId_idx" ON "Atestado"("alunoId");

-- CreateIndex
CREATE INDEX "Atestado_dataInicio_dataFim_idx" ON "Atestado"("dataInicio", "dataFim");

-- CreateIndex
CREATE INDEX "Frequencia_justificativaId_idx" ON "Frequencia"("justificativaId");

-- AddForeignKey
ALTER TABLE "Frequencia" ADD CONSTRAINT "Frequencia_justificativaId_fkey" FOREIGN KEY ("justificativaId") REFERENCES "Atestado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atestado" ADD CONSTRAINT "Atestado_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
