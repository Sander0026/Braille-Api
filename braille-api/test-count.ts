import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.aluno.count();
  const ativos = await prisma.aluno.count({ where: { statusAtivo: true, excluido: false } });
  const inativos = await prisma.aluno.count({ where: { statusAtivo: false } });
  const excluidos = await prisma.aluno.count({ where: { excluido: true } });
  
  console.log('Total no DB:', total);
  console.log('Ativos (valendo na dashboard):', ativos);
  console.log('Inativos:', inativos);
  console.log('Excluídos:', excluidos);

  // também pegar a última matrícula
  const last = await prisma.aluno.findFirst({
    orderBy: { criadoEm: 'desc' }
  });
  console.log('Último inserido:', last?.nomeCompleto, 'em', last?.criadoEm, 'statusAtivo:', last?.statusAtivo);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
