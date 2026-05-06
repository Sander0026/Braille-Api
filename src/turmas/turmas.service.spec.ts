import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAcao, MatriculaStatus, Role, TurmaStatus } from '@prisma/client';
import { TurmasService } from './turmas.service';

describe('TurmasService', () => {
  const auditUser = { sub: 'user-1', nome: 'Admin', role: 'ADMIN' };

  const criarService = () => {
    const tx = {
      turma: {
        update: jest.fn().mockResolvedValue({
          id: 'turma-1',
          nome: 'Braille Basico',
          status: TurmaStatus.CONCLUIDA,
          statusAtivo: false,
        }),
      },
      matriculaOficina: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const prisma = {
      user: {
        findMany: jest.fn(),
      },
      turma: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'turma-1',
          nome: 'Braille Basico',
          status: TurmaStatus.ANDAMENTO,
          professorId: 'prof-1',
          professorAuxiliarId: null,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TurmasService(prisma as never, auditService as never);
    return { service, prisma, tx, auditService };
  };

  it('filtra professores ativos pelo role correto', async () => {
    const { service, prisma } = criarService();
    prisma.user.findMany.mockResolvedValue([{ id: 'prof-1', nome: 'Professor' }]);

    await service.findProfessoresAtivos();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: Role.PROFESSOR,
          statusAtivo: true,
          excluido: false,
        }),
      }),
    );
  });

  it('limita a listagem do perfil PROFESSOR as turmas em que ele esta vinculado', async () => {
    const { service, prisma } = criarService();

    await service.findAll(
      { page: 1, limit: 10, professorId: 'outro-prof' },
      { sub: 'prof-1', role: Role.PROFESSOR } as never,
    );

    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ professorId: 'prof-1' }, { professorAuxiliarId: 'prof-1' }],
        }),
      }),
    );
    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.objectContaining({ professorId: 'outro-prof' }),
      }),
    );
    expect(prisma.turma.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ professorId: 'prof-1' }, { professorAuxiliarId: 'prof-1' }],
      }),
    });
  });

  it('bloqueia detalhe de turma nao vinculada ao PROFESSOR', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-2',
      nome: 'Mobilidade',
      professorId: 'prof-2',
      professorAuxiliarId: null,
      matriculasOficina: [],
      gradeHoraria: [],
    });

    await expect(service.findOne('turma-2', { sub: 'prof-1', role: Role.PROFESSOR } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('conclui turma pela maquina de estados e encerra matriculas ativas', async () => {
    const { service, tx, auditService } = criarService();

    const result = await service.concluir('turma-1', auditUser as never);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'turma-1',
        status: TurmaStatus.CONCLUIDA,
        statusAtivo: false,
      }),
    );
    expect(tx.turma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'turma-1' },
        data: { status: TurmaStatus.CONCLUIDA, statusAtivo: false },
      }),
    );
    expect(tx.matriculaOficina.updateMany).toHaveBeenCalledWith({
      where: { turmaId: 'turma-1', status: MatriculaStatus.ATIVA },
      data: { status: MatriculaStatus.CONCLUIDA, dataEncerramento: expect.any(Date) },
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Turma',
        registroId: 'turma-1',
        acao: AuditAcao.MUDAR_STATUS,
        oldValue: { status: TurmaStatus.ANDAMENTO },
        newValue: { status: TurmaStatus.CONCLUIDA, statusAtivo: false },
      }),
    );
  });

  it('bloqueia atalho que tenta furar transicao invalida', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.CONCLUIDA,
    });

    await expect(service.cancelar('turma-1', auditUser as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
