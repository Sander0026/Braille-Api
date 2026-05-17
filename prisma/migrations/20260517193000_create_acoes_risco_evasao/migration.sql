CREATE TYPE "NivelRiscoEvasao" AS ENUM (
  'ALTO',
  'MEDIO',
  'BAIXO'
);

CREATE TYPE "StatusAcaoRiscoEvasao" AS ENUM (
  'PENDENTE',
  'EM_ANDAMENTO',
  'RESOLVIDA',
  'SEM_CONTATO',
  'CANCELADA'
);

CREATE TYPE "TipoAcaoRiscoEvasao" AS ENUM (
  'CONTATO_TELEFONICO',
  'WHATSAPP',
  'REUNIAO_PRESENCIAL',
  'ENCAMINHAMENTO_ASSISTENCIAL',
  'AJUSTE_DE_HORARIO',
  'TRANSFERENCIA_DE_TURMA',
  'JUSTIFICATIVA_DE_FALTA',
  'VISITA_DOMICILIAR',
  'OUTRO'
);

CREATE TABLE "AcaoRiscoEvasao" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "turmaId" TEXT,
  "responsavelId" TEXT,
  "nivel" "NivelRiscoEvasao" NOT NULL,
  "tipoAcao" "TipoAcaoRiscoEvasao" NOT NULL,
  "status" "StatusAcaoRiscoEvasao" NOT NULL DEFAULT 'PENDENTE',
  "motivoRisco" TEXT NOT NULL,
  "descricao" TEXT,
  "prazo" TIMESTAMP(3),
  "resultado" TEXT,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "resolvidoEm" TIMESTAMP(3),

  CONSTRAINT "AcaoRiscoEvasao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcaoRiscoEvasao_alunoId_idx" ON "AcaoRiscoEvasao"("alunoId");
CREATE INDEX "AcaoRiscoEvasao_turmaId_idx" ON "AcaoRiscoEvasao"("turmaId");
CREATE INDEX "AcaoRiscoEvasao_responsavelId_idx" ON "AcaoRiscoEvasao"("responsavelId");
CREATE INDEX "AcaoRiscoEvasao_status_idx" ON "AcaoRiscoEvasao"("status");
CREATE INDEX "AcaoRiscoEvasao_nivel_idx" ON "AcaoRiscoEvasao"("nivel");
CREATE INDEX "AcaoRiscoEvasao_prazo_idx" ON "AcaoRiscoEvasao"("prazo");

ALTER TABLE "AcaoRiscoEvasao"
  ADD CONSTRAINT "AcaoRiscoEvasao_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AcaoRiscoEvasao"
  ADD CONSTRAINT "AcaoRiscoEvasao_turmaId_fkey"
  FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AcaoRiscoEvasao"
  ADD CONSTRAINT "AcaoRiscoEvasao_responsavelId_fkey"
  FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
