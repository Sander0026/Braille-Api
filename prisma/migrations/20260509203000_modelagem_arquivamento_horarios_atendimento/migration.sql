-- Separa arquivamento administrativo do status pedagogico.
ALTER TABLE "AcompanhamentoIndividual"
  ADD COLUMN "arquivado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AcompanhamentoIndividual"
SET
  "arquivado" = true,
  "status" = COALESCE("statusAntesArquivamento", 'EM_ANDAMENTO'::"StatusAcompanhamentoIndividual")
WHERE "status" = 'ARQUIVADO'::"StatusAcompanhamentoIndividual";

ALTER TABLE "AcompanhamentoIndividual"
  ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "StatusAcompanhamentoIndividual_new" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO');

ALTER TABLE "AcompanhamentoIndividual"
  ALTER COLUMN "status" TYPE "StatusAcompanhamentoIndividual_new"
  USING ("status"::text::"StatusAcompanhamentoIndividual_new");

ALTER TYPE "StatusAcompanhamentoIndividual" RENAME TO "StatusAcompanhamentoIndividual_old";
ALTER TYPE "StatusAcompanhamentoIndividual_new" RENAME TO "StatusAcompanhamentoIndividual";

DROP TYPE "StatusAcompanhamentoIndividual_old";

ALTER TABLE "AcompanhamentoIndividual"
  ALTER COLUMN "status" SET DEFAULT 'EM_ANDAMENTO';

ALTER TABLE "AcompanhamentoIndividual"
  DROP COLUMN "statusAntesArquivamento";

CREATE INDEX "AcompanhamentoIndividual_arquivado_idx" ON "AcompanhamentoIndividual"("arquivado");
CREATE INDEX "AcompanhamentoIndividual_alunoId_status_arquivado_idx" ON "AcompanhamentoIndividual"("alunoId", "status", "arquivado");
CREATE INDEX "AcompanhamentoIndividual_professorId_status_arquivado_idx" ON "AcompanhamentoIndividual"("professorId", "status", "arquivado");

-- Armazena horarios em minutos desde meia-noite para calculos e consultas.
ALTER TABLE "AtendimentoIndividual"
  ADD COLUMN "horaInicioMinutos" INTEGER,
  ADD COLUMN "horaFimMinutos" INTEGER;

UPDATE "AtendimentoIndividual"
SET "horaInicioMinutos" =
  (split_part("horaInicio", ':', 1)::INTEGER * 60) + split_part("horaInicio", ':', 2)::INTEGER
WHERE "horaInicio" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

UPDATE "AtendimentoIndividual"
SET "horaFimMinutos" =
  (split_part("horaFim", ':', 1)::INTEGER * 60) + split_part("horaFim", ':', 2)::INTEGER
WHERE "horaFim" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE "AtendimentoIndividual"
  DROP COLUMN "horaInicio",
  DROP COLUMN "horaFim";
