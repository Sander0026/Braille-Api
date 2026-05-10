import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AtendimentosIndividuaisPolicy } from './atendimentos-individuais.policy';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';

function makeUser(role: Role, sub = 'user-1'): AuthenticatedUser {
  return { sub, role, nome: 'Teste' };
}

describe('AtendimentosIndividuaisPolicy', () => {
  let policy: AtendimentosIndividuaisPolicy;

  beforeEach(() => {
    policy = new AtendimentosIndividuaisPolicy();
  });

  // ─── canArchive ────────────────────────────────────────────────────

  it('canArchive deve retornar true apenas para ADMIN', () => {
    expect(policy.canArchive(makeUser(Role.ADMIN))).toBe(true);
    expect(policy.canArchive(makeUser(Role.SECRETARIA))).toBe(false);
    expect(policy.canArchive(makeUser(Role.PROFESSOR))).toBe(false);
    expect(policy.canArchive(undefined)).toBe(false);
  });

  it('canViewArchivedList deve permitir apenas ADMIN e SECRETARIA', () => {
    expect(policy.canViewArchivedList(makeUser(Role.ADMIN))).toBe(true);
    expect(policy.canViewArchivedList(makeUser(Role.SECRETARIA))).toBe(true);
    expect(policy.canViewArchivedList(makeUser(Role.PROFESSOR))).toBe(false);
    expect(policy.canViewArchivedList(undefined)).toBe(false);
  });

  // ─── canCreate ─────────────────────────────────────────────────────

  it('canCreate deve retornar true para ADMIN, SECRETARIA e PROFESSOR', () => {
    expect(policy.canCreate(makeUser(Role.ADMIN))).toBe(true);
    expect(policy.canCreate(makeUser(Role.SECRETARIA))).toBe(true);
    expect(policy.canCreate(makeUser(Role.PROFESSOR))).toBe(true);
    expect(policy.canCreate(undefined)).toBe(false);
  });

  // ─── canCreateAtendimento ──────────────────────────────────────────

  it('canCreateAtendimento deve retornar false para SECRETARIA', () => {
    const recurso = { professorId: 'prof-1' };
    expect(policy.canCreateAtendimento(makeUser(Role.SECRETARIA), recurso)).toBe(false);
    expect(policy.canCreateAtendimento(makeUser(Role.ADMIN), recurso)).toBe(true);
    expect(policy.canCreateAtendimento(makeUser(Role.PROFESSOR, 'prof-1'), recurso)).toBe(true);
    expect(policy.canCreateAtendimento(makeUser(Role.PROFESSOR, 'prof-outro'), recurso)).toBe(false);
  });

  // ─── canView ───────────────────────────────────────────────────────

  it('canView deve retornar false para PROFESSOR quando professorId difere', () => {
    expect(policy.canView(makeUser(Role.PROFESSOR, 'prof-1'), { professorId: 'prof-outro' })).toBe(false);
    expect(policy.canView(makeUser(Role.PROFESSOR, 'prof-1'), { professorId: 'prof-1' })).toBe(true);
    expect(policy.canView(makeUser(Role.ADMIN), { professorId: 'prof-outro' })).toBe(true);
    expect(policy.canView(makeUser(Role.SECRETARIA), { professorId: 'prof-outro' })).toBe(true);
  });

  // ─── canReopen ─────────────────────────────────────────────────────

  it('canReopen deve retornar true apenas para ADMIN', () => {
    expect(policy.canReopen(makeUser(Role.ADMIN))).toBe(true);
    expect(policy.canReopen(makeUser(Role.SECRETARIA))).toBe(false);
    expect(policy.canReopen(makeUser(Role.PROFESSOR))).toBe(false);
  });

  // ─── assert methods ────────────────────────────────────────────────

  it('assertCanArchive deve lancar ForbiddenException para nao-ADMIN', () => {
    expect(() => policy.assertCanArchive(makeUser(Role.ADMIN))).not.toThrow();
    expect(() => policy.assertCanArchive(makeUser(Role.SECRETARIA))).toThrow(ForbiddenException);
    expect(() => policy.assertCanArchive(makeUser(Role.PROFESSOR))).toThrow(ForbiddenException);
  });

  // ─── canDownloadFile (LGPD: SECRETARIA tem acesso) ────────────────

  it('canDownloadFile deve permitir ADMIN, SECRETARIA e PROFESSOR dono', () => {
    const recurso = { professorId: 'prof-1' };
    expect(policy.canDownloadFile(makeUser(Role.ADMIN), recurso)).toBe(true);
    expect(policy.canDownloadFile(makeUser(Role.SECRETARIA), recurso)).toBe(true);
    expect(policy.canDownloadFile(makeUser(Role.PROFESSOR, 'prof-1'), recurso)).toBe(true);
    expect(policy.canDownloadFile(makeUser(Role.PROFESSOR, 'prof-outro'), recurso)).toBe(false);
    expect(policy.canDownloadFile(undefined, recurso)).toBe(false);
  });
});
