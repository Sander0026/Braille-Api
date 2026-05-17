CREATE TYPE "MotivoInativacaoAluno" AS ENUM (
  'EVASAO_INSTITUCIONAL',
  'MUDANCA_DE_CIDADE',
  'PROBLEMA_SAUDE',
  'PROBLEMA_FAMILIAR',
  'DIFICULDADE_TRANSPORTE',
  'FALECIMENTO',
  'SOLICITACAO_DO_ALUNO',
  'FALTA_DE_CONTATO',
  'CADASTRO_DUPLICADO',
  'OUTRO'
);

ALTER TABLE "Aluno"
  ADD COLUMN "motivoInativacao" "MotivoInativacaoAluno",
  ADD COLUMN "observacaoInativacao" TEXT,
  ADD COLUMN "inativadoEm" TIMESTAMP(3),
  ADD COLUMN "inativadoPorId" TEXT,
  ADD COLUMN "reativadoEm" TIMESTAMP(3),
  ADD COLUMN "reativadoPorId" TEXT,
  ADD COLUMN "motivoReativacao" TEXT;

CREATE INDEX "Aluno_motivoInativacao_idx" ON "Aluno"("motivoInativacao");
CREATE INDEX "Aluno_inativadoPorId_idx" ON "Aluno"("inativadoPorId");
