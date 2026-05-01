import { Role } from '@prisma/client';
import { AuditUser } from '../interfaces/audit-user.interface';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export interface AuditMetadata {
  autorId?: string;
  autorNome?: string;
  autorRole?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Extrai os dados de auditoria de uma requisição autenticada.
 *
 * Helper centralizado — elimina a duplicação de getAuditUser()
 * que existia em 8+ controllers do projeto.
 *
 * O IP é extraído com suporte a proxies reversos (x-forwarded-for / x-real-ip),
 * tomando sempre o primeiro IP da cadeia (IP real do cliente).
 *
 * @param req  Requisição Express enriquecida pelo AuthGuard (JWT parsed)
 * @returns    Objeto AuditUser com todos os campos necessários para auditoria
 */
export function getAuditUser(req: AuthenticatedRequest): AuditUser {
  const user = req.user;
  const role = user?.role ?? Role.SECRETARIA; // fallback seguro: menor privilégio

  return {
    sub: user?.sub ?? '',
    nome: user?.nome ?? user?.email ?? 'Desconhecido',
    role,
    ip: resolverIp(req),
    userAgent: req.headers['user-agent'],
  };
}

export function toAuditMetadata(auditUser: AuditUser): AuditMetadata {
  return {
    autorId: auditUser.sub,
    autorNome: auditUser.nome,
    autorRole: auditUser.role,
    ip: auditUser.ip,
    userAgent: auditUser.userAgent,
  };
}

/**
 * Resolve o IP real do cliente com suporte a proxies reversos.
 * Exportada para reutilização no AuditInterceptor — elimina duplicação.
 */
export function resolverIp(req: AuthenticatedRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.socket?.remoteAddress;
}
