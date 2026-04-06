import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  sub:   string;
  role:  Role;
  /** Nome do utilizador injetado no JWT payload pelo AuthService. */
  nome?: string;
  /** Email como fallback para identificação em logs de auditoria. */
  email?: string;
}

/**
 * Interface padronizada para requisições Express onde o AuthGuard (JWT) injetou
 * as propriedades do usuário logado (sub: string de UUID, role: Enum).
 * Evita o uso excessivo de `any` para manipulações seguras de Token.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  /** Valor anterior do registo, populado por middlewares antes da mutação (para auditoria). */
  auditOldValue?: unknown;
}
