-- ============================================================
-- MIGRATION BASELINE — Idempotente (pode rodar em banco vazio ou parcialmente populado)
-- ============================================================

-- Enums (idempotente)
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TipoDeficiencia" AS ENUM ('CEGUEIRA_TOTAL', 'BAIXA_VISAO', 'VISAO_MONOCULAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CausaDeficiencia" AS ENUM ('CONGENITA', 'ADQUIRIDA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PreferenciaAcessibilidade" AS ENUM ('BRAILLE', 'FONTE_AMPLIADA', 'ARQUIVO_DIGITAL', 'AUDIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "CategoriaComunicado" AS ENUM ('NOTICIA', 'SERVICO', 'VAGA_EMPREGO', 'EVENTO_CULTURAL', 'LEGISLACAO', 'TRABALHO_PCD', 'GERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "MatriculaStatus" AS ENUM ('ATIVA', 'CONCLUIDA', 'EVADIDA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User
CREATE TABLE IF NOT EXISTS "User" (
    "id"                 TEXT NOT NULL,
    "matricula"          TEXT,
    "nome"               TEXT NOT NULL,
    "username"           TEXT NOT NULL,
    "email"              TEXT,
    "senha"              TEXT NOT NULL,
    "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "role"               "Role" NOT NULL DEFAULT 'PROFESSOR',
    "fotoPerfil"         TEXT,
    "statusAtivo"        BOOLEAN NOT NULL DEFAULT true,
    "excluido"           BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Aluno
CREATE TABLE IF NOT EXISTS "Aluno" (
    "id"                  TEXT NOT NULL,
    "matricula"           TEXT,
    "nomeCompleto"        TEXT NOT NULL,
    "dataNascimento"      TIMESTAMP(3) NOT NULL,
    "fotoPerfil"          TEXT,
    "cpfRg"               TEXT NOT NULL,
    "genero"              TEXT,
    "estadoCivil"         TEXT,
    "cep"                 TEXT,
    "rua"                 TEXT,
    "numero"              TEXT,
    "complemento"         TEXT,
    "bairro"              TEXT,
    "cidade"              TEXT,
    "uf"                  TEXT,
    "pontoReferencia"     TEXT,
    "telefoneContato"     TEXT,
    "email"               TEXT,
    "contatoEmergencia"   TEXT,
    "tipoDeficiencia"     "TipoDeficiencia",
    "causaDeficiencia"    "CausaDeficiencia",
    "idadeOcorrencia"     TEXT,
    "possuiLaudo"         BOOLEAN NOT NULL DEFAULT false,
    "laudoUrl"            TEXT,
    "tecAssistivas"       TEXT,
    "escolaridade"        TEXT,
    "profissao"           TEXT,
    "rendaFamiliar"       TEXT,
    "beneficiosGov"       TEXT,
    "composicaoFamiliar"  TEXT,
    "precisaAcompanhante" BOOLEAN NOT NULL DEFAULT false,
    "acompOftalmologico"  BOOLEAN NOT NULL DEFAULT false,
    "outrasComorbidades"  TEXT,
    "prefAcessibilidade"  "PreferenciaAcessibilidade",
    "statusAtivo"         BOOLEAN NOT NULL DEFAULT true,
    "excluido"            BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- Turma
CREATE TABLE IF NOT EXISTS "Turma" (
    "id"               TEXT NOT NULL,
    "nome"             TEXT NOT NULL,
    "descricao"        TEXT,
    "horario"          TEXT,
    "capacidadeMaxima" INTEGER,
    "statusAtivo"      BOOLEAN NOT NULL DEFAULT true,
    "excluido"         BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"     TIMESTAMP(3) NOT NULL,
    "professorId"      TEXT NOT NULL,
    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- MatriculaOficina (pivot Aluno <> Turma com histórico)
CREATE TABLE IF NOT EXISTS "MatriculaOficina" (
    "id"               TEXT NOT NULL,
    "status"           "MatriculaStatus" NOT NULL DEFAULT 'ATIVA',
    "dataEntrada"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataEncerramento" TIMESTAMP(3),
    "observacao"       TEXT,
    "criadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"     TIMESTAMP(3) NOT NULL,
    "alunoId"          TEXT NOT NULL,
    "turmaId"          TEXT NOT NULL,
    CONSTRAINT "MatriculaOficina_pkey" PRIMARY KEY ("id")
);

-- Frequencia
CREATE TABLE IF NOT EXISTS "Frequencia" (
    "id"         TEXT NOT NULL,
    "dataAula"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presente"   BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "alunoId"    TEXT NOT NULL,
    "turmaId"    TEXT NOT NULL,
    CONSTRAINT "Frequencia_pkey" PRIMARY KEY ("id")
);

-- Comunicado
CREATE TABLE IF NOT EXISTS "Comunicado" (
    "id"           TEXT NOT NULL,
    "titulo"       TEXT NOT NULL,
    "conteudo"     TEXT NOT NULL,
    "categoria"    "CategoriaComunicado" NOT NULL DEFAULT 'GERAL',
    "imagemCapa"   TEXT,
    "fixado"       BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "autorId"      TEXT NOT NULL,
    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- MensagemContato
CREATE TABLE IF NOT EXISTS "MensagemContato" (
    "id"        TEXT NOT NULL,
    "nome"      TEXT NOT NULL,
    "email"     TEXT,
    "telefone"  TEXT,
    "assunto"   TEXT NOT NULL,
    "mensagem"  TEXT NOT NULL,
    "lida"      BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensagemContato_pkey" PRIMARY KEY ("id")
);

-- SiteConfig
CREATE TABLE IF NOT EXISTS "SiteConfig" (
    "chave"        TEXT NOT NULL,
    "valor"        TEXT NOT NULL,
    "tipo"         TEXT NOT NULL DEFAULT 'texto',
    "descricao"    TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("chave")
);

-- ConteudoSecao
CREATE TABLE IF NOT EXISTS "ConteudoSecao" (
    "secao" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    CONSTRAINT "ConteudoSecao_pkey" PRIMARY KEY ("secao", "chave")
);

-- Unique Indexes (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS "User_matricula_key"   ON "User"("matricula");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key"    ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"       ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Aluno_matricula_key"  ON "Aluno"("matricula");
CREATE UNIQUE INDEX IF NOT EXISTS "Aluno_cpfRg_key"      ON "Aluno"("cpfRg");
CREATE UNIQUE INDEX IF NOT EXISTS "MatriculaOficina_alunoId_turmaId_key" ON "MatriculaOficina"("alunoId", "turmaId");
CREATE UNIQUE INDEX IF NOT EXISTS "Frequencia_dataAula_alunoId_turmaId_key" ON "Frequencia"("dataAula", "alunoId", "turmaId");

-- Regular Indexes
CREATE INDEX IF NOT EXISTS "User_statusAtivo_excluido_idx"     ON "User"("statusAtivo", "excluido");
CREATE INDEX IF NOT EXISTS "User_role_idx"                     ON "User"("role");
CREATE INDEX IF NOT EXISTS "Aluno_statusAtivo_excluido_idx"    ON "Aluno"("statusAtivo", "excluido");
CREATE INDEX IF NOT EXISTS "Aluno_nomeCompleto_idx"            ON "Aluno"("nomeCompleto");
CREATE INDEX IF NOT EXISTS "Aluno_matricula_idx"               ON "Aluno"("matricula");
CREATE INDEX IF NOT EXISTS "Turma_statusAtivo_excluido_idx"    ON "Turma"("statusAtivo", "excluido");
CREATE INDEX IF NOT EXISTS "Turma_professorId_idx"             ON "Turma"("professorId");
CREATE INDEX IF NOT EXISTS "MatriculaOficina_alunoId_idx"      ON "MatriculaOficina"("alunoId");
CREATE INDEX IF NOT EXISTS "MatriculaOficina_turmaId_status_idx" ON "MatriculaOficina"("turmaId", "status");
CREATE INDEX IF NOT EXISTS "Frequencia_alunoId_idx"            ON "Frequencia"("alunoId");
CREATE INDEX IF NOT EXISTS "Frequencia_turmaId_dataAula_idx"   ON "Frequencia"("turmaId", "dataAula");
CREATE INDEX IF NOT EXISTS "Comunicado_categoria_idx"          ON "Comunicado"("categoria");
CREATE INDEX IF NOT EXISTS "Comunicado_fixado_criadoEm_idx"    ON "Comunicado"("fixado", "criadoEm");
CREATE INDEX IF NOT EXISTS "Comunicado_autorId_idx"            ON "Comunicado"("autorId");

-- Foreign Keys (idempotente)
DO $$ BEGIN
    ALTER TABLE "Turma" ADD CONSTRAINT "Turma_professorId_fkey"
        FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatriculaOficina" ADD CONSTRAINT "MatriculaOficina_alunoId_fkey"
        FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MatriculaOficina" ADD CONSTRAINT "MatriculaOficina_turmaId_fkey"
        FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Frequencia" ADD CONSTRAINT "Frequencia_alunoId_fkey"
        FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Frequencia" ADD CONSTRAINT "Frequencia_turmaId_fkey"
        FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_autorId_fkey"
        FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
