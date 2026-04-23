/**
 * @module MatriculaGenerator — CLI Script Utility
 *
 * Utilitário genérico e reutilizável para geração de matrículas em lote
 * via scripts de linha de comando (backfill, migrations, etc).
 *
 * DIFERENÇA do matricula.helper.ts (NestJS):
 *   - Este módulo é para scripts standalone (sem o contexto do NestJS DI).
 *   - Usa PrismaClient diretamente (não PrismaService injetável).
 *   - Optimizado para bulk batch: 2 queries totais + 1 $transaction atômica.
 *   - matricula.helper.ts é para uso em runtime (1 registro por vez com lock de unicidade).
 *
 * Algoritmo (O(N) — N = entidades sem matrícula):
 *   1. Busca o teto numérico (matrícula mais alta existente p/ o prefixo).
 *   2. Busca todas as entidades sem matrícula (orderBy criadoEm ASC).
 *   3. Gera os sequenciais in-memory sem mais round-trips ao banco.
 *   4. Commit atômico ACID via prisma.$transaction.
 */

import { PrismaClient } from '@prisma/client';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface MatriculaGeneratorConfig {
  /** Model Prisma alvo. Deve ter: id (String), matricula (String?), criadoEm (DateTime). */
  model: 'aluno' | 'user';
  /** Prefixo da matrícula. Ex: '2026' para Alunos, 'P2026' para Staff. */
  prefix: string;
  /** Número de dígitos do sequencial com zero-padding (default: 5 → '00001'). */
  padLength?: number;
}

export interface MatriculaGeneratorResult {
  geradas: number;
  primeiraNova: string | null;
  ultimaNova: string | null;
}

// ── Helpers Puros (unitariamente testáveis) ────────────────────────────────────

/**
 * Extrai o sequencial numérico de uma matrícula via `slice` (seguro).
 * Motivo: `.replace(prefix, '')` é frágil pois remove a PRIMEIRA ocorrência,
 * podendo corromper sequenciais que contenham o padrão do prefix.
 * Ex: extrairSequencial('2026202600001', '2026') → 202600001 (errado com replace)
 *     extrairSequencial('202600001', '2026') → 1 (correto com slice)
 */
export function extrairSequencial(matricula: string, prefix: string): number {
  const sequencialStr = matricula.slice(prefix.length);
  const valor = Number.parseInt(sequencialStr, 10);
  return Number.isNaN(valor) ? 0 : valor;
}

/**
 * Formata um número em matrícula completa com zero-padding.
 * Ex: formatarMatricula('P2026', 1, 5) → 'P202600001'
 */
export function formatarMatricula(
  prefix: string,
  sequencial: number,
  padLength: number,
): string {
  return `${prefix}${String(sequencial).padStart(padLength, '0')}`;
}

// ── Logger minimalista para scripts CLI (sem dependência do NestJS) ────────────

const log = {
  info:  (msg: string) => console.log(msg),
  warn:  (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

// ── Função Principal ───────────────────────────────────────────────────────────

export async function generateMatriculas(
  prisma: PrismaClient,
  config: MatriculaGeneratorConfig,
): Promise<MatriculaGeneratorResult> {
  const { model, prefix, padLength = 5 } = config;

  // ── Passo 1: Teto numérico — 1 query cirúrgica com select mínimo ──────────
  log.info(`🔍 [${model}] Buscando teto numérico para prefixo "${prefix}"...`);

  const ultimoRegistro = await (prisma[model] as any).findFirst({
    where: { matricula: { startsWith: prefix } },
    orderBy: { matricula: 'desc' },
    select: { matricula: true },
  }) as { matricula: string | null } | null;

  const baseSequencial = ultimoRegistro?.matricula
    ? extrairSequencial(ultimoRegistro.matricula, prefix) + 1
    : 1;

  // ── Passo 2: Entidades pendentes — 1 query cirúrgica com select mínimo ────
  const pendentes = await (prisma[model] as any).findMany({
    where: { matricula: null },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  }) as Array<{ id: string }>;

  // Cláusula de guarda: early return se não há nada a fazer
  if (pendentes.length === 0) {
    log.info(`✅ [${model}] Nenhuma matrícula pendente encontrada. Nada a fazer.`);
    return { geradas: 0, primeiraNova: null, ultimaNova: null };
  }

  log.info(`📋 [${model}] ${pendentes.length} entidade(s) sem matrícula encontrada(s).`);
  log.info(`   Iniciando geração in-memory a partir do sequencial ${baseSequencial}...`);

  // ── Passo 3: Geração in-memory (O(N) — zero round-trips adicionais) ───────
  let sequencial = baseSequencial;

  const updates = pendentes.map(({ id }) => {
    const matricula = formatarMatricula(prefix, sequencial, padLength);
    sequencial++;
    return (prisma[model] as any).update({ where: { id }, data: { matricula } });
  });

  const primeiraNova = formatarMatricula(prefix, baseSequencial, padLength);
  const ultimaNova   = formatarMatricula(prefix, sequencial - 1, padLength);

  // ── Passo 4: Commit atômico ACID ─────────────────────────────────────────
  log.info(`🚀 [${model}] Comitando lote de ${updates.length} registros via $transaction (ACID)...`);
  await prisma.$transaction(updates);

  log.info(`✅ [${model}] Concluído. Faixa gerada: ${primeiraNova} → ${ultimaNova}`);

  return { geradas: updates.length, primeiraNova, ultimaNova };
}
