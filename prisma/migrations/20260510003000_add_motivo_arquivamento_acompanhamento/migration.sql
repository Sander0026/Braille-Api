-- AddMotivoArquivamento
ALTER TABLE "AcompanhamentoIndividual"
  ADD COLUMN IF NOT EXISTS "motivoArquivamento" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoDesarquivamento" TEXT;
