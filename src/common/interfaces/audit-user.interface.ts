import { Role } from '@prisma/client';

/**
 * Dados do utilizador autenticado para registo de auditoria.
 *
 * Tipo centralizado — única fonte de verdade para todo o projeto.
 * Elimina a duplicação de AuditUserParams que existia em 10+ módulos.
 *
 * Uso: import { AuditUser } from 'src/common/interfaces/audit-user.interface'
 * Helper: getAuditUser(req) em src/common/helpers/audit.helper.ts
 */
export interface AuditUser {
  /** UUID do utilizador autenticado (claim sub do JWT). */
  sub: string;
  /** Nome display para snapshots de auditoria. */
  nome: string;
  /** Cargo tipado com o enum do Prisma — elimina os 'as any' do role. */
  role: Role;
  /** IP real do cliente (com suporte a x-forwarded-for). */
  ip?: string;
  /** User-Agent do cliente HTTP. */
  userAgent?: string;
}
