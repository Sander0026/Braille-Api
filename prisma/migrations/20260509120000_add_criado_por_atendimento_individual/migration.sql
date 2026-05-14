-- Rastreia o usuario que registrou cada atendimento individual.
ALTER TABLE "AtendimentoIndividual"
ADD COLUMN "criadoPorId" TEXT;

CREATE INDEX "AtendimentoIndividual_criadoPorId_idx"
ON "AtendimentoIndividual"("criadoPorId");

ALTER TABLE "AtendimentoIndividual"
ADD CONSTRAINT "AtendimentoIndividual_criadoPorId_fkey"
FOREIGN KEY ("criadoPorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
