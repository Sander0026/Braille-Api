import { AuditAcao } from '@prisma/client';

/**
 * Opções para registro de log de auditoria no sistema.
 * Não use any: se precisar passar objetos complexos, o sistema
 * tentará serializá-los com segurança nativamente.
 */
export interface AuditOptions {
    entidade: string;
    registroId?: string;
    acao: AuditAcao;
    autorId?: string;
    autorNome?: string;
    autorRole?: string;
    ip?: string;
    userAgent?: string;
    oldValue?: unknown;
    newValue?: unknown;
}
