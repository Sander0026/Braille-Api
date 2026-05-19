CREATE TYPE "TipoEventoLinhaTempoAluno" AS ENUM (
  'CADASTRO',
  'ATUALIZACAO_CADASTRO',
  'MATRICULA_TURMA',
  'ENCERRAMENTO_MATRICULA',
  'FREQUENCIA_PRESENTE',
  'FREQUENCIA_FALTA',
  'FREQUENCIA_FALTA_JUSTIFICADA',
  'ATENDIMENTO_INDIVIDUAL',
  'FALTA_ATENDIMENTO',
  'ATESTADO',
  'LAUDO',
  'CERTIFICADO',
  'PDI_CRIADO',
  'PDI_META_CRIADA',
  'PDI_META_ATUALIZADA',
  'PDI_EVOLUCAO',
  'ACAO_RISCO_EVASAO',
  'ACAO_RISCO_RESOLVIDA',
  'INATIVACAO',
  'REATIVACAO',
  'OBSERVACAO_MANUAL'
);

CREATE TYPE "OrigemEventoLinhaTempo" AS ENUM (
  'ALUNO',
  'MATRICULA_OFICINA',
  'FREQUENCIA',
  'ATENDIMENTO_INDIVIDUAL',
  'ATESTADO',
  'LAUDO_MEDICO',
  'CERTIFICADO',
  'PDI',
  'PDI_META',
  'PDI_EVOLUCAO',
  'ACAO_RISCO_EVASAO',
  'AUDIT_LOG',
  'MANUAL'
);

CREATE TYPE "VisibilidadeEventoLinhaTempo" AS ENUM (
  'INTERNA',
  'PROFESSOR',
  'RESTRITA'
);

CREATE TABLE "EventoLinhaTempoAluno" (
  "id" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL,
  "turmaId" TEXT,
  "usuarioId" TEXT,
  "tipo" "TipoEventoLinhaTempoAluno" NOT NULL,
  "origem" "OrigemEventoLinhaTempo" NOT NULL,
  "origemId" TEXT,
  "chaveEvento" TEXT NOT NULL,
  "dataEvento" TIMESTAMP(3) NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "turmaNomeSnapshot" TEXT,
  "professorNomeSnapshot" TEXT,
  "usuarioNomeSnapshot" TEXT,
  "metadata" JSONB,
  "visibilidade" "VisibilidadeEventoLinhaTempo" NOT NULL DEFAULT 'INTERNA',
  "sensivel" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventoLinhaTempoAluno_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoLinhaTempoAluno_chaveEvento_key" ON "EventoLinhaTempoAluno"("chaveEvento");
CREATE INDEX "EventoLinhaTempoAluno_alunoId_dataEvento_idx" ON "EventoLinhaTempoAluno"("alunoId", "dataEvento");
CREATE INDEX "EventoLinhaTempoAluno_alunoId_tipo_idx" ON "EventoLinhaTempoAluno"("alunoId", "tipo");
CREATE INDEX "EventoLinhaTempoAluno_turmaId_idx" ON "EventoLinhaTempoAluno"("turmaId");
CREATE INDEX "EventoLinhaTempoAluno_usuarioId_idx" ON "EventoLinhaTempoAluno"("usuarioId");
CREATE INDEX "EventoLinhaTempoAluno_origem_origemId_idx" ON "EventoLinhaTempoAluno"("origem", "origemId");
CREATE INDEX "EventoLinhaTempoAluno_dataEvento_idx" ON "EventoLinhaTempoAluno"("dataEvento");
CREATE INDEX "EventoLinhaTempoAluno_visibilidade_idx" ON "EventoLinhaTempoAluno"("visibilidade");

ALTER TABLE "EventoLinhaTempoAluno"
  ADD CONSTRAINT "EventoLinhaTempoAluno_alunoId_fkey"
  FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventoLinhaTempoAluno"
  ADD CONSTRAINT "EventoLinhaTempoAluno_turmaId_fkey"
  FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventoLinhaTempoAluno"
  ADD CONSTRAINT "EventoLinhaTempoAluno_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
