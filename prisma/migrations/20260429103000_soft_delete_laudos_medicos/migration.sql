-- Preserve historico medico: laudos removidos passam a ser revogados logicamente.
ALTER TABLE "LaudoMedico"
  ADD COLUMN "excluidoEm" TIMESTAMP(3),
  ADD COLUMN "excluidoPorId" TEXT;

CREATE INDEX "LaudoMedico_excluidoEm_idx" ON "LaudoMedico"("excluidoEm");
