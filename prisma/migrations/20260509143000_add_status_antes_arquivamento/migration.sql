-- Preserva o status pedagogico anterior ao arquivamento administrativo.
ALTER TABLE "AcompanhamentoIndividual"
ADD COLUMN "statusAntesArquivamento" "StatusAcompanhamentoIndividual";
