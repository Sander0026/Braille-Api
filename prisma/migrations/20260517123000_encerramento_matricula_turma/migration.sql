ALTER TYPE "MatriculaStatus" ADD VALUE IF NOT EXISTS 'TRANSFERIDA';

CREATE TYPE "MotivoEncerramentoMatricula" AS ENUM (
  'CONCLUSAO',
  'EVASAO_SEM_JUSTIFICATIVA',
  'MUDANCA_DE_TURNO',
  'TRANSFERENCIA_DE_TURMA',
  'MUDANCA_DE_CIDADE',
  'DIFICULDADE_TRANSPORTE',
  'PROBLEMA_SAUDE',
  'PROBLEMA_FAMILIAR',
  'INCOMPATIBILIDADE_HORARIO',
  'FALTA_DE_CONTATO',
  'DESISTENCIA_VOLUNTARIA',
  'CANCELAMENTO_DA_TURMA',
  'OUTRO'
);

ALTER TABLE "MatriculaOficina"
  ADD COLUMN "motivoEncerramento" "MotivoEncerramentoMatricula",
  ADD COLUMN "encerradoPorId" TEXT,
  ADD COLUMN "encerradoEm" TIMESTAMP(3);

CREATE INDEX "MatriculaOficina_motivoEncerramento_idx" ON "MatriculaOficina"("motivoEncerramento");
CREATE INDEX "MatriculaOficina_encerradoPorId_idx" ON "MatriculaOficina"("encerradoPorId");
