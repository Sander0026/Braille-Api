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

    console.log(`🔍 Localizando teto numérico (matrícula mais alta) para o prefixo ${prefix}...`);
    const ultimoRegistro = await prisma.aluno.findFirst({
        where: { matricula: { startsWith: prefix } },
        orderBy: { matricula: 'desc' },
        select: { matricula: true }
    });

    let sequencial = 1;
    if (ultimoRegistro && ultimoRegistro.matricula) {
        // Separa o prefixo (ex: '2026') do sequencial ('00014')
        const nroStr = ultimoRegistro.matricula.replace(prefix, '');
        const maxNro = parseInt(nroStr, 10);
        if (!isNaN(maxNro)) {
            sequencial = maxNro + 1;
        }
    }

    const alunosSemMatricula = await prisma.aluno.findMany({
        where: { matricula: null },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, nomeCompleto: true },
    });

    if (alunosSemMatricula.length === 0) {
        console.log(`🎓 Alertas de vazio: Nenhuma matrícula nova pendente para Alunos.`);
        return;
    }

    console.log(`🎓 Gerando ${alunosSemMatricula.length} matrículas in-memory...`);
    
    // Geração na RAM (O(N)) - Desativa Code Smell de N+1 Loops
    const updates = alunosSemMatricula.map((aluno) => {
        const matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        sequencial++;
        return prisma.aluno.update({ where: { id: aluno.id }, data: { matricula } });
    });

    console.log(`🚀 Comitando Lote Transacional (Prisma.$transaction)...`);
    await prisma.$transaction(updates);
    
    console.log(`  ✅ OK! Ex de matrícula gerada: ${prefix}${String(sequencial - updates.length).padStart(5, '0')} a ${prefix}${String(sequencial - 1).padStart(5, '0')}.`);
}

async function backfillStaffMatriculas() {
    const ano = new Date().getFullYear();
    const prefix = `P${ano}`;

    console.log(`🔍 Localizando teto numérico (matrícula mais alta) para o prefixo da Staff ${prefix}...`);
    const ultimoRegistro = await prisma.user.findFirst({
        where: { matricula: { startsWith: prefix } },
        orderBy: { matricula: 'desc' },
        select: { matricula: true }
    });

    let sequencial = 1;
    if (ultimoRegistro && ultimoRegistro.matricula) {
        const nroStr = ultimoRegistro.matricula.replace(prefix, '');
        const maxNro = parseInt(nroStr, 10);
        if (!isNaN(maxNro)) {
            sequencial = maxNro + 1;
        }
    }

    const staffSemMatricula = await prisma.user.findMany({
        where: { matricula: null },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, nome: true },
    });

    if (staffSemMatricula.length === 0) {
        console.log(`👤 Alertas de vazio: Nenhum funcionário pendente de matrícula.`);
        return;
    }

    console.log(`👤 Gerando ${staffSemMatricula.length} matrículas para staff (Custo-Zero de Banco)...`);

    const updates = staffSemMatricula.map((user) => {
        const matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
        sequencial++;
        return prisma.user.update({ where: { id: user.id }, data: { matricula } });
    });

    console.log(`🚀 Comitando Lote Funcional via Transactions...`);
    await prisma.$transaction(updates);

    console.log(`  ✅ Concluído (Sequencial parou em: ${prefix}${String(sequencial - 1).padStart(5, '0')}).`);
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
