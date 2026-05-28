import { PrismaClient } from '@prisma/client';
import { EventoLinhaTempoService } from '../../src/aluno-linha-tempo/evento-linha-tempo.service';
import { LinhaTempoBackfillService } from '../../src/aluno-linha-tempo/linha-tempo-backfill.service';

const prisma = new PrismaClient();

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const alunoId = getArgValue('alunoId');
  const eventoService = new EventoLinhaTempoService(prisma as never);
  const backfill = new LinhaTempoBackfillService(prisma as never, eventoService);

  if (alunoId) {
    const eventos = await backfill.backfillAluno(alunoId);
    console.log(`Backfill concluido para aluno ${alunoId}. Eventos processados: ${eventos}.`);
    return;
  }

  const resultado = await backfill.backfillTodos();
  console.log(
    `Backfill concluido. Alunos processados: ${resultado.alunos}. Eventos processados: ${resultado.eventos}.`,
  );
}

main()
  .catch((error) => {
    console.error('Falha ao executar backfill da linha do tempo.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
