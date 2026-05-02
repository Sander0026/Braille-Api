/**
 * Gerador de Números de Matrícula Institucional
 *
 * Alunos: YYYYNNNNN  (Ex: 202600001)
 * Staff:  PYYYYNNNNN (Ex: P202600001)
 *
 * Geração garantida como UNIQUE via banco (campo @unique no schema).
 * O formato usa o ano atual + sequencial de 5 dígitos zero-padded.
 *
 * Race condition: loop while com MAX_TENTATIVAS=10 para prevenir busy-wait infinito
 * em cenários de alta concorrência.
 */

import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Aceita tanto PrismaService quanto o cliente de transação ($transaction callback)
type PrismaClientOrTx =
  | Prisma.TransactionClient
  | {
      aluno: Prisma.TransactionClient['aluno'];
      user: Prisma.TransactionClient['user'];
    };

/** Número máximo de tentativas antes de lançar exceção (previne busy-wait infinito). */
const MAX_TENTATIVAS = 10;

/**
 * Função interna DRY: gera a próxima matrícula única para uma entidade.
 *
 * @param prefix     Prefixo da matrícula (ex: '2026' para alunos, 'P2026' para staff)
 * @param countFn    Função que conta registros com o prefix — retorna o sequencial inicial
 * @param existsFn   Função que verifica se uma matrícula já existe
 */
async function gerarMatriculaUnica(
  prefix: string,
  countFn: () => Promise<number>,
  existsFn: (matricula: string) => Promise<unknown>,
): Promise<string> {
  const count = await countFn();
  let sequencial = count + 1;
  let matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
  let tentativas = 0;

  while (await existsFn(matricula)) {
    tentativas++;
    if (tentativas >= MAX_TENTATIVAS) {
      throw new InternalServerErrorException(
        `Não foi possível gerar uma matrícula única após ${MAX_TENTATIVAS} tentativas. ` +
          `Verifique o sequencial do prefixo "${prefix}".`,
      );
    }
    sequencial++;
    matricula = `${prefix}${String(sequencial).padStart(5, '0')}`;
  }

  return matricula;
}

/**
 * Gera o próximo número de matrícula para Aluno.
 * Formato: YYYY + 5 dígitos (ex: 202600001).
 * Funciona tanto fora quanto dentro de $transaction.
 */
export async function gerarMatriculaAluno(prisma: PrismaClientOrTx): Promise<string> {
  const prefix = `${new Date().getFullYear()}`;
  return gerarMatriculaUnica(
    prefix,
    () => prisma.aluno.count({ where: { matricula: { startsWith: prefix } } }),
    (m) => prisma.aluno.findUnique({ where: { matricula: m }, select: { matricula: true } }),
  );
}

/**
 * Gera o próximo número de matrícula para Staff (prefixo P).
 * Formato: P + YYYY + 5 dígitos (ex: P202600001).
 * Funciona tanto fora quanto dentro de $transaction.
 */
export async function gerarMatriculaStaff(prisma: PrismaClientOrTx): Promise<string> {
  const prefix = `P${new Date().getFullYear()}`;
  return gerarMatriculaUnica(
    prefix,
    () => prisma.user.count({ where: { matricula: { startsWith: prefix } } }),
    (m) => prisma.user.findUnique({ where: { matricula: m }, select: { matricula: true } }),
  );
}
