CREATE TYPE "StatusPdi" AS ENUM (
  'ATIVO',
  'CONCLUIDO',
  'SUSPENSO',
  'ARQUIVADO'
);

CREATE TYPE "AreaPdi" AS ENUM (
  'BRAILLE',
  'ORIENTACAO_MOBILIDADE',
  'INFORMATICA_ACESSIVEL',
  'AUTONOMIA',
  'SOCIALIZACAO',
  'ATIVIDADE_PEDAGOGICA',
  'OUTRO'
);

CREATE TYPE "StatusMetaPdi" AS ENUM (
  'NAO_INICIADA',
  'EM_ANDAMENTO',
  'ALCANCADA',
  'PARCIALMENTE_ALCANCADA',
  'NAO_ALCANCADA',
  'CANCELADA'
);

CREATE TABLE "PdiAluno" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "professorResponsavelId" TEXT,
  "titulo" TEXT NOT NULL,
  "objetivoGeral" TEXT NOT NULL,
  "diagnosticoInicial" TEXT,
  "necessidadesAcessibilidade" TEXT,
  "recursosUtilizados" TEXT,
  "observacoesGerais" TEXT,
  "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataFimPrevista" TIMESTAMP(3),
  "dataConclusao" TIMESTAMP(3),
  "status" "StatusPdi" NOT NULL DEFAULT 'ATIVO',
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PdiAluno_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PdiMeta" (
  "id" TEXT NOT NULL,
  "pdiId" TEXT NOT NULL,
  "area" "AreaPdi" NOT NULL,
  "descricao" TEXT NOT NULL,
  "estrategia" TEXT,
  "prazo" TIMESTAMP(3),
  "status" "StatusMetaPdi" NOT NULL DEFAULT 'NAO_INICIADA',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PdiMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PdiEvolucao" (
  "id" TEXT NOT NULL,
  "pdiId" TEXT NOT NULL,
  "dataRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "descricao" TEXT NOT NULL,
  "dificuldades" TEXT,
  "avancos" TEXT,
  "proximosPassos" TEXT,
  "registradoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PdiEvolucao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PdiAluno_alunoId_idx" ON "PdiAluno"("alunoId");
CREATE INDEX "PdiAluno_professorResponsavelId_idx" ON "PdiAluno"("professorResponsavelId");
CREATE INDEX "PdiAluno_status_idx" ON "PdiAluno"("status");
CREATE INDEX "PdiMeta_pdiId_idx" ON "PdiMeta"("pdiId");
CREATE INDEX "PdiMeta_area_idx" ON "PdiMeta"("area");
CREATE INDEX "PdiMeta_status_idx" ON "PdiMeta"("status");
CREATE INDEX "PdiEvolucao_pdiId_idx" ON "PdiEvolucao"("pdiId");
CREATE INDEX "PdiEvolucao_registradoPorId_idx" ON "PdiEvolucao"("registradoPorId");
CREATE INDEX "PdiEvolucao_dataRegistro_idx" ON "PdiEvolucao"("dataRegistro");

ALTER TABLE "PdiAluno"
  ADD CONSTRAINT "PdiAluno_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PdiAluno"
  ADD CONSTRAINT "PdiAluno_professorResponsavelId_fkey"
  FOREIGN KEY ("professorResponsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PdiMeta"
  ADD CONSTRAINT "PdiMeta_pdiId_fkey"
  FOREIGN KEY ("pdiId") REFERENCES "PdiAluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PdiEvolucao"
  ADD CONSTRAINT "PdiEvolucao_pdiId_fkey"
  FOREIGN KEY ("pdiId") REFERENCES "PdiAluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PdiEvolucao"
  ADD CONSTRAINT "PdiEvolucao_registradoPorId_fkey"
  FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
