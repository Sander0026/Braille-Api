import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';

type RecursoComProfessor = {
  professorId: string;
};

@Injectable()
export class AtendimentosIndividuaisPolicy {
  canCreate(user?: AuthenticatedUser): boolean {
    return this.isAdminOrSecretaria(user) || user?.role === Role.PROFESSOR;
  }

  canView(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdminOrSecretaria(user) || user?.role === Role.PROFESSOR && recurso.professorId === user.sub;
  }

  canMutate(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.canView(user, recurso);
  }

  canGenerateReport(user?: AuthenticatedUser): boolean {
    return this.isAdminOrSecretaria(user) || user?.role === Role.PROFESSOR;
  }

  assertCanCreate(user?: AuthenticatedUser): void {
    if (!this.canCreate(user)) {
      throw new ForbiddenException('Seu perfil nao tem permissao para criar acompanhamento individual.');
    }
  }

  assertCanView(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canView(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para visualizar este acompanhamento individual.');
    }
  }

  assertCanMutate(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canMutate(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para alterar este acompanhamento individual.');
    }
  }

  private isAdminOrSecretaria(user?: AuthenticatedUser): boolean {
    return user?.role === Role.ADMIN || user?.role === Role.SECRETARIA;
  }
}
