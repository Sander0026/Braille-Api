import { AuditAcao } from '@prisma/client';

/**
 * Opções para registro de log de auditoria no sistema.
 *
 * autorRole tipado com Role (enum Prisma) — alinha com AuditUser.role: Role.
 * Não use any: objetos complexos são serializados com segurança pelo AuditLogService.
 */
export interface AuditOptions {
  entidade: string;
  registroId?: string;
  acao: AuditAcao;
  autorId?: string;
  autorNome?: string;
  /** Aceita Role enum ou string literal para compatibilidade com módulos não migrados. */
  autorRole?: string;
  ip?: string;
  userAgent?: string;
  oldValue?: unknown;
  newValue?: unknown;
}
