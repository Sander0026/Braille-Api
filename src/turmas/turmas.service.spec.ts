import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAcao, MatriculaStatus, MotivoEncerramentoMatricula, Role, TurmaStatus } from '@prisma/client';
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
        findUnique: jest.fn().mockResolvedValue({ id: 'prof-1', role: Role.PROFESSOR }),
      },
      aluno: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      turma: {
        create: jest.fn().mockResolvedValue({
          id: 'turma-nova',
          nome: 'Braille Basico',
          status: TurmaStatus.PREVISTA,
          statusAtivo: true,
        }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'turma-1',
          nome: 'Braille Basico',
          status: TurmaStatus.ANDAMENTO,
          statusAtivo: true,
          excluido: false,
          professorId: 'prof-1',
          professorAuxiliarId: null,
        }),
      },
      matriculaOficina: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
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

  it('deriva statusAtivo do status academico ao criar turma', async () => {
    const { service, prisma } = criarService();

    await service.create(
      {
        nome: 'Turma Cancelada',
        professorId: 'prof-1',
        status: TurmaStatus.CANCELADA,
      } as never,
      auditUser as never,
    );

    expect(prisma.turma.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TurmaStatus.CANCELADA,
          statusAtivo: false,
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
      data: {
        status: MatriculaStatus.CONCLUIDA,
        dataEncerramento: expect.any(Date),
        motivoEncerramento: MotivoEncerramentoMatricula.CONCLUSAO,
        encerradoEm: expect.any(Date),
        encerradoPorId: auditUser.sub,
      },
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

  it('arquiva turma em operacao mudando status academico para cancelada', async () => {
    const { service, tx } = criarService();
    tx.turma.update.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.CANCELADA,
      statusAtivo: false,
    });

    const result = await service.arquivar('turma-1', auditUser as never);

    expect(result).toEqual(
      expect.objectContaining({
        status: TurmaStatus.CANCELADA,
        statusAtivo: false,
      }),
    );
    expect(tx.turma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: TurmaStatus.CANCELADA, statusAtivo: false },
      }),
    );
  });

  it('restaura turma cancelada reabrindo como prevista', async () => {
    const { service, prisma, tx } = criarService();
    prisma.turma.findUnique
      .mockResolvedValueOnce({
        id: 'turma-1',
        nome: 'Braille Basico',
        status: TurmaStatus.CANCELADA,
        statusAtivo: false,
        excluido: false,
      })
      .mockResolvedValueOnce({
        id: 'turma-1',
        nome: 'Braille Basico',
        status: TurmaStatus.CANCELADA,
      });
    tx.turma.update.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.PREVISTA,
      statusAtivo: true,
    });

    const result = await service.restaurar('turma-1', auditUser as never);

    expect(result).toEqual(
      expect.objectContaining({
        status: TurmaStatus.PREVISTA,
        statusAtivo: true,
      }),
    );
    expect(tx.turma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: TurmaStatus.PREVISTA, statusAtivo: true },
      }),
    );
  });

  it('bloqueia restauracao de turma concluida', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.CONCLUIDA,
      statusAtivo: false,
      excluido: false,
    });

    await expect(service.restaurar('turma-1', auditUser as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  it.each([TurmaStatus.CONCLUIDA, TurmaStatus.CANCELADA])(
    'bloqueia matricula de aluno em turma com status %s',
    async (status) => {
      const { service, prisma } = criarService();
      prisma.turma.findUnique.mockResolvedValueOnce({
        id: 'turma-1',
        nome: 'Braille Basico',
        status,
        capacidadeMaxima: 10,
        gradeHoraria: [],
        _count: { matriculasOficina: 0 },
      });

      await expect(service.addAluno('turma-1', 'aluno-1', auditUser as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.aluno.findUnique).not.toHaveBeenCalled();
      expect(prisma.matriculaOficina.create).not.toHaveBeenCalled();
    },
  );

  it('valida conflito de professor apenas contra turmas previstas ou em andamento', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.ANDAMENTO,
      professorId: 'prof-1',
      professorAuxiliarId: null,
      gradeHoraria: [],
      dataInicio: null,
      dataFim: null,
      cargaHoraria: null,
    });
    prisma.turma.findMany.mockResolvedValueOnce([]);

    await service.update(
      'turma-1',
      {
        professorId: 'prof-1',
        gradeHoraria: [{ dia: 'SEG', horaInicio: 480, horaFim: 660 }],
      } as never,
      auditUser as never,
    );

    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          professorId: 'prof-1',
          excluido: false,
          status: { in: [TurmaStatus.PREVISTA, TurmaStatus.ANDAMENTO] },
          id: { not: 'turma-1' },
        },
        include: { gradeHoraria: true },
      }),
    );
    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.objectContaining({ statusAtivo: true }),
      }),
    );
  });

  it('valida conflito de aluno apenas contra matriculas ativas em turmas previstas ou em andamento', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Braille Basico',
      status: TurmaStatus.ANDAMENTO,
      capacidadeMaxima: null,
      gradeHoraria: [{ dia: 'SEG', horaInicio: 480, horaFim: 660 }],
      _count: { matriculasOficina: 0 },
    });
    prisma.aluno.findUnique.mockResolvedValueOnce({ id: 'aluno-1', nomeCompleto: 'Ana Silva' });
    prisma.matriculaOficina.findFirst.mockResolvedValueOnce(null);
    prisma.matriculaOficina.findMany.mockResolvedValueOnce([]);
    prisma.matriculaOficina.create.mockResolvedValueOnce({
      id: 'mat-1',
      aluno: { id: 'aluno-1', nomeCompleto: 'Ana Silva', matricula: 'A001' },
    });

    await service.addAluno('turma-1', 'aluno-1', auditUser as never);

    expect(prisma.matriculaOficina.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          alunoId: 'aluno-1',
          status: MatriculaStatus.ATIVA,
          turmaId: { not: 'turma-1' },
          turma: {
            excluido: false,
            status: { in: [TurmaStatus.PREVISTA, TurmaStatus.ANDAMENTO] },
          },
        },
        include: {
          turma: { include: { gradeHoraria: true } },
        },
      }),
    );
  });

  it('lista alunos disponiveis desconsiderando conflitos de turmas concluidas ou canceladas', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findUnique.mockResolvedValueOnce({
      id: 'turma-1',
      gradeHoraria: [{ dia: 'SEG', horaInicio: 480, horaFim: 660 }],
    });
    prisma.turma.findMany.mockResolvedValueOnce([]);
    prisma.aluno.findMany.mockResolvedValueOnce([]);

    await service.findAlunosDisponiveis('turma-1');

    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          excluido: false,
          status: { in: [TurmaStatus.PREVISTA, TurmaStatus.ANDAMENTO] },
          id: { not: 'turma-1' },
        },
        include: { gradeHoraria: true },
      }),
    );
    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.objectContaining({ statusAtivo: true }),
      }),
    );
    expect(prisma.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matriculasOficina: {
            none: {
              status: MatriculaStatus.ATIVA,
              turmaId: { in: ['turma-1'] },
            },
          },
        }),
      }),
    );
  });

  it('encerra matricula ativa com status, motivo e auditoria', async () => {
    const { service, prisma, auditService } = criarService();
    prisma.matriculaOficina.findFirst.mockResolvedValue({
      id: 'mat-1',
      aluno: { nomeCompleto: 'Ana Silva' },
      turma: { nome: 'Braille Basico' },
    });
    prisma.matriculaOficina.update.mockResolvedValue({
      id: 'mat-1',
      status: MatriculaStatus.EVADIDA,
      motivoEncerramento: MotivoEncerramentoMatricula.FALTA_DE_CONTATO,
    });

    await service.encerrarMatricula(
      'turma-1',
      'aluno-1',
      {
        status: MatriculaStatus.EVADIDA,
        motivoEncerramento: MotivoEncerramentoMatricula.FALTA_DE_CONTATO,
        observacao: 'Nao respondeu aos contatos',
        dataEncerramento: '2026-05-10',
      } as never,
      auditUser as never,
    );

    expect(prisma.matriculaOficina.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mat-1' },
        data: expect.objectContaining({
          status: MatriculaStatus.EVADIDA,
          motivoEncerramento: MotivoEncerramentoMatricula.FALTA_DE_CONTATO,
          observacao: 'Nao respondeu aos contatos',
          dataEncerramento: expect.any(Date),
          encerradoEm: expect.any(Date),
          encerradoPorId: auditUser.sub,
        }),
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'MatriculaOficina',
        registroId: 'mat-1',
        acao: AuditAcao.DESMATRICULAR,
      }),
    );
  });

  it('bloqueia remocao direta de aluno sem motivo estruturado', async () => {
    const { service, prisma } = criarService();

    await expect(service.removeAluno('turma-1', 'aluno-1', auditUser as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.matriculaOficina.update).not.toHaveBeenCalled();
  });
});
