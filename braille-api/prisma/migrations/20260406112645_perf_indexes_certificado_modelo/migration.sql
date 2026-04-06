-- ──────────────────────────────────────────────────────────────────────────────
-- Migração: Índices de Performance — CertificadoEmitido e ModeloCertificado
--
-- Objetivo: Adicionar índices para consultas frequentes sem alterar estrutura de dados.
-- Esta migração é SEGURA e IDEMPOTENTE (IF NOT EXISTS) — sem risco de perda de dados.
-- ──────────────────────────────────────────────────────────────────────────────

-- Índice composto para CertificadoEmitido:
-- Otimiza a query mais frequente: certificados de um aluno em uma turma específica.
-- PostgreSQL usa índices compostos para WHERE alunoId = X AND turmaId = Y de forma
-- mais eficiente do que dois índices simples separados.
CREATE INDEX IF NOT EXISTS "CertificadoEmitido_alunoId_turmaId_idx"
  ON "CertificadoEmitido"("alunoId", "turmaId");

-- Índice por tipo em ModeloCertificado:
-- Otimiza filtros por WHERE tipo = 'ACADEMICO' ou tipo = 'HONRARIA'.
-- Sem este índice, cada listagem por tipo resultaria em full-table scan.
CREATE INDEX IF NOT EXISTS "ModeloCertificado_tipo_idx"
  ON "ModeloCertificado"("tipo");
