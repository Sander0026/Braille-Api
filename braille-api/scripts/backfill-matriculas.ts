/**
 * Script de Backfill de Matrículas
 *
 * Roda UMA ÚNICA VEZ para gerar matrículas para Alunos e Staff
 * que já existem no banco sem matrícula atribuída.
 *
 * Uso:
 *   npx ts-node scripts/backfill-matriculas.ts
 *
 * Resultado esperado:
 *   Alunos → formato YYYYNNNNN  (ex: 202600001)
 *   Staff  → formato PYYYYNNNNN (ex: P202600001)
 */

import { PrismaClient } from '@prisma/client';
import { generateMatriculas } from './lib/matricula-generator.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ano = new Date().getFullYear();

  console.log('🚀 Iniciando backfill de matrículas...\n');

  // Alunos e Staff processados sequencialmente para evitar sobrecarga no banco.
  // Se o banco tiver alta capacidade, podem ser paralelizados com Promise.all.

  const resultadoAlunos = await generateMatriculas(prisma, {
    model: 'aluno',
    prefix: `${ano}`,
    padLength: 5,
  });

  console.log('');

  const resultadoStaff = await generateMatriculas(prisma, {
    model: 'user',
    prefix: `P${ano}`,
    padLength: 5,
  });

  // ── Relatório final ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('📊 RELATÓRIO FINAL — Backfill de Matrículas');
  console.log('══════════════════════════════════════════');
  console.log(`🎓 Alunos : ${resultadoAlunos.geradas} matriculado(s).`);
  console.log(`👤 Staff  : ${resultadoStaff.geradas} matriculado(s).`);
  console.log('══════════════════════════════════════════\n');
}

// ── Execução com tratamento de erros estruturado ──────────────────────────────

main()
  .catch((err: unknown) => {
    // Não expõe stack trace sensível — registra a mensagem de erro e encerra com código de falha.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Backfill falhou: ${message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
