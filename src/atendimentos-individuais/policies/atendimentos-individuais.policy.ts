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

  canCreateAtendimento(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdmin(user) || this.isProfessorOwner(user, recurso);
  }

  canUpdateSubject(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdmin(user) || this.isProfessorOwner(user, recurso);
  }

  canFinish(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdmin(user) || this.isProfessorOwner(user, recurso);
  }

  canAttachFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdmin(user) || this.isProfessorOwner(user, recurso);
  }

  canRemoveFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor, criadoPorId?: string | null): boolean {
    if (this.isAdmin(user)) return true;
    return this.isProfessorOwner(user, recurso) && !!criadoPorId && criadoPorId === user?.sub;
  }

  /**
   * SECRETARIA pode baixar todos os anexos (incluindo atestados/laudos).
   * Decisão confirmada pelo stakeholder — LGPD: download auditado.
   */
  canDownloadFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return this.isAdminOrSecretaria(user) || this.isProfessorOwner(user, recurso);
  }

  canReopen(user?: AuthenticatedUser): boolean {
    return this.isAdmin(user);
  }

  canArchive(user?: AuthenticatedUser): boolean {
    return this.isAdmin(user);
  }

  canViewArchivedList(user?: AuthenticatedUser): boolean {
    return this.isAdminOrSecretaria(user);
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

  assertCanCreateAtendimento(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canCreateAtendimento(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para registrar atendimento neste acompanhamento individual.');
    }
  }

  assertCanUpdateSubject(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canUpdateSubject(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para alterar o assunto deste acompanhamento individual.');
    }
  }

  assertCanFinish(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canFinish(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para finalizar este acompanhamento individual.');
    }
  }

  assertCanAttachFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canAttachFile(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para anexar arquivos neste atendimento individual.');
    }
  }

  assertCanRemoveFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor, criadoPorId?: string | null): void {
    if (!this.canRemoveFile(user, recurso, criadoPorId)) {
      throw new ForbiddenException('Voce nao tem permissao para remover este arquivo de atendimento individual.');
    }
  }

  assertCanDownloadFile(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): void {
    if (!this.canDownloadFile(user, recurso)) {
      throw new ForbiddenException('Voce nao tem permissao para baixar este arquivo de atendimento individual.');
    }
  }

  assertCanReopen(user?: AuthenticatedUser): void {
    if (!this.canReopen(user)) {
      throw new ForbiddenException('Voce nao tem permissao para alterar este acompanhamento individual.');
    }
  }

  assertCanArchive(user?: AuthenticatedUser): void {
    if (!this.canArchive(user)) {
      throw new ForbiddenException('Voce nao tem permissao para arquivar este acompanhamento individual.');
    }
  }

  assertCanViewArchivedList(user?: AuthenticatedUser): void {
    if (!this.canViewArchivedList(user)) {
      throw new ForbiddenException('Voce nao tem permissao para consultar acompanhamentos arquivados.');
    }
  }

  private isAdmin(user?: AuthenticatedUser): boolean {
    return user?.role === Role.ADMIN;
  }

  private isAdminOrSecretaria(user?: AuthenticatedUser): boolean {
    return user?.role === Role.ADMIN || user?.role === Role.SECRETARIA;
  }

  private isProfessorOwner(user: AuthenticatedUser | undefined, recurso: RecursoComProfessor): boolean {
    return user?.role === Role.PROFESSOR && recurso.professorId === user.sub;
  }
}
