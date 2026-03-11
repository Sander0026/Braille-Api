/**
 * Gerador de Números de Matrícula Institucional
 *
 * Alunos: YYYYNNNNN  (Ex: 202600001)
 * Staff:  PYYYYNNNNN (Ex: P202600001)
 *
 * Geração garantida como UNIQUE via banco (campo @unique no schema).
 * O formato usa o ano atual + sequencial de 5 dígitos zero-padded.
 */

import { Prisma } from '@prisma/client';

// Aceita tanto PrismaService quanto o cliente de transação (Prisma.$transaction callback)
type PrismaClientOrTx = Prisma.TransactionClient | { aluno: Prisma.TransactionClient['aluno']; user: Prisma.TransactionClient['user'] };

/**
 * Gera o próximo número de matrícula para Aluno.
 * Forma: YYYY + 5 dígitos baseado no total de alunos +1.
 * Funciona tanto fora quanto dentro de $transaction.
 */
export async function gerarMatriculaAluno(prisma: PrismaClientOrTx): Promise<string> {
    const ano = new Date().getFullYear();
    const prefix = `${ano}`;

    // Conta alunos com matrícula iniciando com o ano atual
    const count = await prisma.aluno.count({
        where: { matricula: { startsWith: prefix } },
    });

    let sequencial = count + 1;
    let matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;

    // Garante unicidade em caso de concorrência
    while (await prisma.aluno.findUnique({ where: { matricula } })) {
        sequencial++;
        matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
    }

    return matricula;
}

/**
 * Gera o próximo número de matrícula para Staff (Prefixo P).
 * Forma: P + YYYY + 5 dígitos baseado no total de users +1.
 * Funciona tanto fora quanto dentro de $transaction.
 */
export async function gerarMatriculaStaff(prisma: PrismaClientOrTx): Promise<string> {
    const ano = new Date().getFullYear();
    const prefix = `P${ano}`;

    const count = await prisma.user.count({
        where: { matricula: { startsWith: prefix } },
    });

    let sequencial = count + 1;
    let matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;

    while (await prisma.user.findUnique({ where: { matricula } })) {
        sequencial++;
        matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
    }

    return matricula;
}
