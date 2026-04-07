/**
 * Ponto de entrada do Prisma Seed.
 *
 * Orquestra os seeders por domínio, mantendo separação de responsabilidades (SRP).
 * Cada seeder é independente, testável isoladamente e pode ser adicionado/removido
 * sem impactar os demais.
 *
 * Execução:
 *   npx prisma db seed
 *
 * Importação de alunos via planilha:
 *   SEED_ALUNOS_CSV=prisma/alunos.xlsx npx prisma db seed
 *   SEED_ALUNOS_CSV=/caminho/absoluto/alunos.xlsx npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { seedAdmin }      from './admin-seeder.js';
import { seedSiteConfig } from './site-config-seeder.js';
import { importarAlunos } from './alunos-seeder.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Iniciando Prisma Seed...\n');

  // Os dois primeiros seeders são independentes — executados em paralelo
  await Promise.all([
    seedAdmin(prisma),
    seedSiteConfig(prisma),
  ]);

  // Importação de alunos é opcional e sequencial (depende do banco estabilizar)
  const csvEnv = process.env.SEED_ALUNOS_CSV;

  if (csvEnv) {
    console.log('');
    await importarAlunos(prisma, csvEnv);
  } else {
    console.log('\n💡 Dica: para importar alunos automaticamente, execute:');
    console.log('   SEED_ALUNOS_CSV=prisma/alunos.xlsx npx prisma db seed\n');
  }

  console.log('\n✅ Seed concluído com sucesso!');
}

main()
  .catch((err: unknown) => {
    // Nunca usa String(err) em objetos arbitrários — evita '[object Object]' no log
    const message = err instanceof Error
      ? err.message
      : JSON.stringify(err, null, 2);
    console.error(`\n❌ Seed falhou: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
