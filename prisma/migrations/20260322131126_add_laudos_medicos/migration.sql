-- CreateTable
CREATE TABLE "LaudoMedico" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "dataEmissao" DATE NOT NULL,
    "medicoResponsavel" TEXT,
    "descricao" TEXT,
    "arquivoUrl" TEXT NOT NULL,
    "registradoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaudoMedico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaudoMedico_alunoId_idx" ON "LaudoMedico"("alunoId");

-- CreateIndex
CREATE INDEX "LaudoMedico_dataEmissao_idx" ON "LaudoMedico"("dataEmissao");

-- AddForeignKey
ALTER TABLE "LaudoMedico" ADD CONSTRAINT "LaudoMedico_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
