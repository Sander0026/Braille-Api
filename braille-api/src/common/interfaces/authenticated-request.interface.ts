import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  role: Role;
}

/**
 * Interface padronizada para requisições Express onde o AuthGuard (JWT) injetou
 * as propriedades do usuário logado (sub: string de UUID, role: Enum).
 * Evita o uso excessivo de `any` para manipulações seguras de Token.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
