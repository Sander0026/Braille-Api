/**
 * Script de Backfill de Matrículas
 *
 * Roda UMA ÚNICA VEZ para gerar matrículas para alunos e staff
 * que já existem no banco de dados. Após rodar, pode ser deletado.
 *
 * Uso: npx ts-node -e "require('./scripts/backfill-matriculas')"
 *      OU: npx ts-node scripts/backfill-matriculas.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillAlunosMatriculas() {
    const ano = new Date().getFullYear();
    const prefix = `${ano}`;

    const alunosSemMatricula = await prisma.aluno.findMany({
        where: { matricula: null },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, nomeCompleto: true },
    });

    console.log(`🎓 Gerando matrículas para ${alunosSemMatricula.length} alunos...`);
    let sequencial = 1;

    for (const aluno of alunosSemMatricula) {
        let matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        while (await prisma.aluno.findUnique({ where: { matricula } })) {
            sequencial++;
            matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        }
        await prisma.aluno.update({ where: { id: aluno.id }, data: { matricula } });
        console.log(`  ✅ ${aluno.nomeCompleto} → ${matricula}`);
        sequencial++;
    }
}

async function backfillStaffMatriculas() {
    const ano = new Date().getFullYear();
    const prefix = `P${ano}`;

    const staffSemMatricula = await prisma.user.findMany({
        where: { matricula: null },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, nome: true },
    });

    console.log(`👤 Gerando matrículas para ${staffSemMatricula.length} funcionários...`);
    let sequencial = 1;

    for (const user of staffSemMatricula) {
        let matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        while (await prisma.user.findUnique({ where: { matricula } })) {
            sequencial++;
            matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        }
        await prisma.user.update({ where: { id: user.id }, data: { matricula } });
        console.log(`  ✅ ${user.nome} → ${matricula}`);
        sequencial++;
    }
}

async function main() {
    console.log('🚀 Iniciando backfill de matrículas...\n');
    await backfillAlunosMatriculas();
    console.log('');
    await backfillStaffMatriculas();
    console.log('\n✅ Backfill concluído!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
