-- Auditoria operacional de arquivamento e remocao logica de anexos de atendimentos individuais
ALTER TABLE "AcompanhamentoIndividual"
  ADD COLUMN "arquivadoEm" TIMESTAMP(3),
  ADD COLUMN "arquivadoPorId" TEXT,
  ADD COLUMN "desarquivadoEm" TIMESTAMP(3),
  ADD COLUMN "desarquivadoPorId" TEXT;

ALTER TABLE "ArquivoAtendimentoIndividual"
  ADD COLUMN "excluidoEm" TIMESTAMP(3),
  ADD COLUMN "excluidoPorId" TEXT,
  ADD COLUMN "motivoExclusao" TEXT;

CREATE INDEX "AcompanhamentoIndividual_arquivadoPorId_idx" ON "AcompanhamentoIndividual"("arquivadoPorId");
CREATE INDEX "AcompanhamentoIndividual_desarquivadoPorId_idx" ON "AcompanhamentoIndividual"("desarquivadoPorId");
CREATE INDEX "ArquivoAtendimentoIndividual_excluidoEm_idx" ON "ArquivoAtendimentoIndividual"("excluidoEm");
CREATE INDEX "ArquivoAtendimentoIndividual_excluidoPorId_idx" ON "ArquivoAtendimentoIndividual"("excluidoPorId");

ALTER TABLE "AcompanhamentoIndividual"
  ADD CONSTRAINT "AcompanhamentoIndividual_arquivadoPorId_fkey" FOREIGN KEY ("arquivadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcompanhamentoIndividual"
  ADD CONSTRAINT "AcompanhamentoIndividual_desarquivadoPorId_fkey" FOREIGN KEY ("desarquivadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ArquivoAtendimentoIndividual"
  ADD CONSTRAINT "ArquivoAtendimentoIndividual_excluidoPorId_fkey" FOREIGN KEY ("excluidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
