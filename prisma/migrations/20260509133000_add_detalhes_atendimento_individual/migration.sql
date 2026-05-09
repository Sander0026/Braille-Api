-- Detalhes operacionais do atendimento individual.
CREATE TYPE "ModalidadeAtendimentoIndividual" AS ENUM ('PRESENCIAL', 'REMOTO', 'TELEFONE', 'OUTRO');

ALTER TABLE "AtendimentoIndividual"
ADD COLUMN "horaInicio" TEXT,
ADD COLUMN "horaFim" TEXT,
ADD COLUMN "duracaoMinutos" INTEGER,
ADD COLUMN "modalidade" "ModalidadeAtendimentoIndividual",
ADD COLUMN "localAtendimento" TEXT;
