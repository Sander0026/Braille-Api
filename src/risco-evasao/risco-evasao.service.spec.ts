import { BadRequestException } from '@nestjs/common';
import {
  NivelRiscoEvasao,
  Role,
  StatusAcaoRiscoEvasao,
  TipoAcaoRiscoEvasao,
} from '@prisma/client';
import { RiscoEvasaoService } from './risco-evasao.service';

describe('RiscoEvasaoService', () => {
  const auditUser = {
    sub: 'admin-1',
    nome: 'Admin',
    role: Role.ADMIN,
    ip: '127.0.0.1',
    userAgent: 'jest',
  };

  const criarAcao = (overrides: Record<string, unknown> = {}) => ({
    id: 'acao-1',
    alunoId: 'aluno-1',
    turmaId: 'turma-1',
    responsavelId: 'resp-1',
    nivel: NivelRiscoEvasao.ALTO,
    tipoAcao: TipoAcaoRiscoEvasao.CONTATO_TELEFONICO,
    status: StatusAcaoRiscoEvasao.PENDENTE,
    motivoRisco: '3 faltas seguidas',
    descricao: null,
    prazo: new Date('2999-05-20T23:59:59.999Z'),
    resultado: null,
    criadoPorId: 'admin-1',
    criadoEm: new Date('2026-05-17T10:00:00.000Z'),
    atualizadoEm: new Date('2026-05-17T10:00:00.000Z'),
    resolvidoEm: null,
    aluno: {
      id: 'aluno-1',
      nomeCompleto: 'Ana Silva',
      matricula: 'A001',
    },
    turma: {
      id: 'turma-1',
      nome: 'Braille Basico',
      professorId: 'prof-1',
      professor: { id: 'prof-1', nome: 'Professora Ana' },
    },
    responsavel: {
      id: 'resp-1',
      nome: 'Secretaria',
      role: Role.SECRETARIA,
    },
    ...overrides,
  });

  const criarService = () => {
    const prisma = {
      aluno: {
        findFirst: jest.fn().mockResolvedValue({ id: 'aluno-1' }),
      },
      turma: {
        findFirst: jest.fn().mockResolvedValue({ id: 'turma-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'resp-1' }),
      },
      acaoRiscoEvasao: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(criarAcao()),
        update: jest.fn().mockResolvedValue(criarAcao()),
      },
    };
    const auditLogService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RiscoEvasaoService(prisma as never, auditLogService as never);

    return { service, prisma, auditLogService };
  };

  it('bloqueia acao aberta duplicada para aluno, turma e motivo', async () => {
    const { service, prisma } = criarService();
    prisma.acaoRiscoEvasao.findFirst.mockResolvedValueOnce({ id: 'existente' });

    await expect(
      service.create(
        {
          alunoId: 'aluno-1',
          turmaId: 'turma-1',
          responsavelId: 'resp-1',
          nivel: NivelRiscoEvasao.ALTO,
          tipoAcao: TipoAcaoRiscoEvasao.CONTATO_TELEFONICO,
          motivoRisco: ' 3 faltas seguidas ',
        },
        { sub: 'admin-1', role: Role.ADMIN } as never,
        auditUser as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.acaoRiscoEvasao.create).not.toHaveBeenCalled();
  });

  it('exige resultado para marcar a acao como resolvida', async () => {
    const { service, prisma } = criarService();
    prisma.acaoRiscoEvasao.findFirst.mockResolvedValueOnce(criarAcao({ resultado: null }));

    await expect(
      service.updateStatus(
        'acao-1',
        { status: StatusAcaoRiscoEvasao.RESOLVIDA },
        auditUser as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.acaoRiscoEvasao.update).not.toHaveBeenCalled();
  });

  it('registra auditoria ao criar acao de intervencao', async () => {
    const { service, prisma, auditLogService } = criarService();

    const acao = await service.create(
      {
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        responsavelId: 'resp-1',
        nivel: NivelRiscoEvasao.ALTO,
        tipoAcao: TipoAcaoRiscoEvasao.CONTATO_TELEFONICO,
        motivoRisco: '3 faltas seguidas',
        prazo: '2026-05-20',
      },
      { sub: 'admin-1', role: Role.ADMIN } as never,
      auditUser as never,
    );

    expect(prisma.acaoRiscoEvasao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alunoId: 'aluno-1',
          turmaId: 'turma-1',
          responsavelId: 'resp-1',
          motivoRisco: '3 faltas seguidas',
          criadoPorId: 'admin-1',
        }),
      }),
    );
    expect(acao.vencida).toBe(false);
    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'AcaoRiscoEvasao',
        registroId: 'acao-1',
      }),
    );
  });

  it('restringe listagem de professor as proprias turmas', async () => {
    const { service, prisma } = criarService();

    await service.findAll({}, { sub: 'prof-1', role: Role.PROFESSOR } as never);

    expect(prisma.acaoRiscoEvasao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              turma: {
                OR: [{ professorId: 'prof-1' }, { professorAuxiliarId: 'prof-1' }],
              },
            },
          ],
        },
      }),
    );
  });
});
