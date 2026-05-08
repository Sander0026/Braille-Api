-- Atendimento individual independente de turmas.

CREATE TYPE "StatusAcompanhamentoIndividual" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'ARQUIVADO');

CREATE TYPE "TipoRegistroAtendimentoIndividual" AS ENUM (
  'ATENDIMENTO_REALIZADO',
  'FALTA_JUSTIFICADA',
  'FALTA_NAO_JUSTIFICADA',
  'CANCELADO'
);

CREATE TYPE "CategoriaArquivoAtendimentoIndividual" AS ENUM (
  'ATESTADO',
  'LAUDO',
  'MATERIAL_PEDAGOGICO',
  'DOCUMENTO',
  'OUTRO'
);

CREATE TABLE "AcompanhamentoIndividual" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "professorId" TEXT NOT NULL,
  "assuntoAtual" TEXT NOT NULL,
  "descricao" TEXT,
  "status" "StatusAcompanhamentoIndividual" NOT NULL DEFAULT 'EM_ANDAMENTO',
  "dataInicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataFinalizacao" DATE,
  "resultadoFinal" TEXT,
  "resumoFinal" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "excluidoEm" TIMESTAMP(3),

  CONSTRAINT "AcompanhamentoIndividual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AtendimentoIndividual" (
  "id" TEXT NOT NULL,
  "acompanhamentoId" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "professorId" TEXT NOT NULL,
  "dataAtendimento" DATE NOT NULL,
  "tipoRegistro" "TipoRegistroAtendimentoIndividual" NOT NULL,
  "assuntoDoDia" TEXT,
  "observacao" TEXT,
  "evolucao" TEXT,
  "dificuldades" TEXT,
  "pendencias" TEXT,
  "recomendacoes" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "excluidoEm" TIMESTAMP(3),

  CONSTRAINT "AtendimentoIndividual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArquivoAtendimentoIndividual" (
  "id" TEXT NOT NULL,
  "atendimentoId" TEXT NOT NULL,
  "nomeOriginal" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "urlArquivo" TEXT NOT NULL,
  "tipoArquivo" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "categoria" "CategoriaArquivoAtendimentoIndividual" NOT NULL DEFAULT 'OUTRO',
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArquivoAtendimentoIndividual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HistoricoAssuntoAcompanhamento" (
  "id" TEXT NOT NULL,
  "acompanhamentoId" TEXT NOT NULL,
  "assuntoAnterior" TEXT NOT NULL,
  "assuntoNovo" TEXT NOT NULL,
  "motivoAlteracao" TEXT,
  "alteradoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HistoricoAssuntoAcompanhamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcompanhamentoIndividual_alunoId_status_idx" ON "AcompanhamentoIndividual"("alunoId", "status");
CREATE INDEX "AcompanhamentoIndividual_professorId_status_idx" ON "AcompanhamentoIndividual"("professorId", "status");
CREATE INDEX "AcompanhamentoIndividual_dataInicio_idx" ON "AcompanhamentoIndividual"("dataInicio");
CREATE INDEX "AcompanhamentoIndividual_excluidoEm_idx" ON "AcompanhamentoIndividual"("excluidoEm");

CREATE INDEX "AtendimentoIndividual_acompanhamentoId_dataAtendimento_idx" ON "AtendimentoIndividual"("acompanhamentoId", "dataAtendimento");
CREATE INDEX "AtendimentoIndividual_alunoId_dataAtendimento_idx" ON "AtendimentoIndividual"("alunoId", "dataAtendimento");
CREATE INDEX "AtendimentoIndividual_professorId_dataAtendimento_idx" ON "AtendimentoIndividual"("professorId", "dataAtendimento");
CREATE INDEX "AtendimentoIndividual_tipoRegistro_idx" ON "AtendimentoIndividual"("tipoRegistro");
CREATE INDEX "AtendimentoIndividual_excluidoEm_idx" ON "AtendimentoIndividual"("excluidoEm");

CREATE INDEX "ArquivoAtendimentoIndividual_atendimentoId_idx" ON "ArquivoAtendimentoIndividual"("atendimentoId");
CREATE INDEX "ArquivoAtendimentoIndividual_categoria_idx" ON "ArquivoAtendimentoIndividual"("categoria");
CREATE INDEX "ArquivoAtendimentoIndividual_criadoPorId_idx" ON "ArquivoAtendimentoIndividual"("criadoPorId");

CREATE INDEX "HistoricoAssuntoAcompanhamento_acompanhamentoId_idx" ON "HistoricoAssuntoAcompanhamento"("acompanhamentoId");
CREATE INDEX "HistoricoAssuntoAcompanhamento_alteradoPorId_idx" ON "HistoricoAssuntoAcompanhamento"("alteradoPorId");
CREATE INDEX "HistoricoAssuntoAcompanhamento_criadoEm_idx" ON "HistoricoAssuntoAcompanhamento"("criadoEm");

ALTER TABLE "AcompanhamentoIndividual"
  ADD CONSTRAINT "AcompanhamentoIndividual_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AcompanhamentoIndividual"
  ADD CONSTRAINT "AcompanhamentoIndividual_professorId_fkey"
  FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AtendimentoIndividual"
  ADD CONSTRAINT "AtendimentoIndividual_acompanhamentoId_fkey"
  FOREIGN KEY ("acompanhamentoId") REFERENCES "AcompanhamentoIndividual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AtendimentoIndividual"
  ADD CONSTRAINT "AtendimentoIndividual_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AtendimentoIndividual"
  ADD CONSTRAINT "AtendimentoIndividual_professorId_fkey"
  FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArquivoAtendimentoIndividual"
  ADD CONSTRAINT "ArquivoAtendimentoIndividual_atendimentoId_fkey"
  FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoIndividual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArquivoAtendimentoIndividual"
  ADD CONSTRAINT "ArquivoAtendimentoIndividual_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HistoricoAssuntoAcompanhamento"
  ADD CONSTRAINT "HistoricoAssuntoAcompanhamento_acompanhamentoId_fkey"
  FOREIGN KEY ("acompanhamentoId") REFERENCES "AcompanhamentoIndividual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricoAssuntoAcompanhamento"
  ADD CONSTRAINT "HistoricoAssuntoAcompanhamento_alteradoPorId_fkey"
  FOREIGN KEY ("alteradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
