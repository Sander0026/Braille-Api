-- ──────────────────────────────────────────────────────────────────────────────
-- Migração: Índices de Performance — CertificadoEmitido e ModeloCertificado
--
-- Objetivo: Adicionar índices para consultas frequentes sem alterar estrutura de dados.
-- Esta migração é SEGURA e IDEMPOTENTE também em shadow database: os índices só
-- são criados quando as tabelas alvo já existem na cadeia de migrations.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Índice composto para CertificadoEmitido:
  -- Otimiza a query mais frequente: certificados de um aluno em uma turma específica.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'CertificadoEmitido'
  ) THEN
    CREATE INDEX IF NOT EXISTS "CertificadoEmitido_alunoId_turmaId_idx"
      ON "CertificadoEmitido"("alunoId", "turmaId");
  END IF;

  -- Índice por tipo em ModeloCertificado:
  -- Otimiza filtros por WHERE tipo = 'ACADEMICO' ou tipo = 'HONRARIA'.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ModeloCertificado'
  ) THEN
    CREATE INDEX IF NOT EXISTS "ModeloCertificado_tipo_idx"
      ON "ModeloCertificado"("tipo");
  END IF;
END $$;
