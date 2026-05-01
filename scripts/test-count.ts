/**
 * Script de Diagnóstico do Banco de Dados
 *
 * Exibe contagens e o último registro de Alunos para fins de análise rápida.
 * ATENÇÃO: Este é um utilitário de DESENVOLVIMENTO. Não deve ser executado
 * em ambiente de produção sem as devidas restrições de acesso.
 *
 * Uso:
 *   npx ts-node scripts/test-count.ts
 *
 * Performance:
 *   Todas as queries são executadas em paralelo via Promise.all,
 *   reduzindo o tempo de resposta de (5 × latência) para (1 × latência).
 */

import { PrismaClient, Aluno } from '@prisma/client';

const prisma = new PrismaClient();

// Tipo mínimo para o último aluno inserido — evita trazer todos os campos desnecessariamente
type DiagnosticoAluno = Pick<Aluno, 'nomeCompleto' | 'criadoEm' | 'statusAtivo' | 'matricula'>;

async function main(): Promise<void> {
  console.log('🔍 Executando diagnóstico do banco de dados...\n');

  // Todas as 5 queries executadas em PARALELO — 1 round-trip de latência total
  const [total, ativos, inativos, excluidos, ultimo] = await Promise.all([
    prisma.aluno.count(),
    prisma.aluno.count({ where: { statusAtivo: true,  excluido: false } }),
    prisma.aluno.count({ where: { statusAtivo: false, excluido: false } }),
    prisma.aluno.count({ where: { excluido: true } }),
    prisma.aluno.findFirst({
      orderBy: { criadoEm: 'desc' },
      select: {
        nomeCompleto: true,
        criadoEm:    true,
        statusAtivo: true,
        matricula:   true,
      },
    }) as Promise<DiagnosticoAluno | null>,
  ]);

  console.log('══════════════════════════════════════');
  console.log('📊 Contagens de Alunos');
  console.log('══════════════════════════════════════');
  console.log(`   Total no banco      : ${total}`);
  console.log(`   Ativos              : ${ativos}`);
  console.log(`   Inativos            : ${inativos}`);
  console.log(`   Excluídos (soft)    : ${excluidos}`);
  console.log('══════════════════════════════════════');

  if (ultimo) {
    console.log('\n📌 Último aluno inserido:');
    console.log(`   Nome        : ${ultimo.nomeCompleto}`);
    console.log(`   Matrícula   : ${ultimo.matricula ?? '(sem matrícula)'}`);
    console.log(`   Status ativo: ${ultimo.statusAtivo ? 'Sim' : 'Não'}`);
    console.log(`   Inserido em : ${ultimo.criadoEm.toLocaleString('pt-BR')}`);
  } else {
    console.log('\n⚠️  Nenhum aluno encontrado no banco.');
  }
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Diagnóstico falhou: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
