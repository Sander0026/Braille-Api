import { BadRequestException } from '@nestjs/common';
import { AreaPdi, Role, StatusMetaPdi, StatusPdi } from '@prisma/client';
import { PdiService } from './pdi.service';

describe('PdiService', () => {
  const auditUser = {
    sub: 'admin-1',
    nome: 'Admin',
    role: Role.ADMIN,
    ip: '127.0.0.1',
    userAgent: 'jest',
  };

  const criarPdi = (overrides: Record<string, unknown> = {}) => ({
    id: 'pdi-1',
    alunoId: 'aluno-1',
    professorResponsavelId: 'prof-1',
    titulo: 'PDI Ana',
    objetivoGeral: 'Desenvolver leitura Braille',
    diagnosticoInicial: null,
    necessidadesAcessibilidade: null,
    recursosUtilizados: null,
    observacoesGerais: null,
    dataInicio: new Date('2026-05-17T00:00:00.000Z'),
    dataFimPrevista: null,
    dataConclusao: null,
    status: StatusPdi.ATIVO,
    criadoPorId: 'admin-1',
    criadoEm: new Date('2026-05-17T10:00:00.000Z'),
    atualizadoEm: new Date('2026-05-17T10:00:00.000Z'),
    aluno: { id: 'aluno-1', nomeCompleto: 'Ana Silva', matricula: 'A001', statusAtivo: true },
    professorResponsavel: { id: 'prof-1', nome: 'Professora Ana', role: Role.PROFESSOR },
    metas: [],
    evolucoes: [],
    ...overrides,
  });

  const criarService = () => {
    const prisma = {
      aluno: {
        findFirst: jest.fn().mockResolvedValue({ id: 'aluno-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prof-1' }),
      },
      matriculaOficina: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mat-1' }),
      },
      pdiAluno: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(criarPdi()),
        update: jest.fn().mockResolvedValue(criarPdi({ status: StatusPdi.ARQUIVADO })),
      },
      pdiMeta: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'meta-1',
          pdiId: 'pdi-1',
          area: AreaPdi.BRAILLE,
          descricao: 'Reconhecer alfabeto',
          estrategia: null,
          prazo: null,
          status: StatusMetaPdi.NAO_INICIADA,
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      pdiEvolucao: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    const auditLogService = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new PdiService(prisma as never, auditLogService as never);
    return { service, prisma, auditLogService };
  };

  it('bloqueia criacao quando aluno ja possui PDI ativo', async () => {
    const { service, prisma } = criarService();
    prisma.pdiAluno.findFirst.mockResolvedValueOnce({ id: 'pdi-ativo', titulo: 'PDI atual' });

    await expect(
      service.create(
        {
          alunoId: 'aluno-1',
          titulo: 'Novo PDI',
          objetivoGeral: 'Novo objetivo',
        },
        { sub: 'admin-1', role: Role.ADMIN } as never,
        auditUser as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.pdiAluno.create).not.toHaveBeenCalled();
  });

  it('exige data de conclusao ao concluir PDI', async () => {
    const { service, prisma } = criarService();
    prisma.pdiAluno.findFirst.mockResolvedValueOnce(criarPdi({ dataConclusao: null }));

    await expect(
      service.update(
        'pdi-1',
        { status: StatusPdi.CONCLUIDO },
        { sub: 'admin-1', role: Role.ADMIN } as never,
        auditUser as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.pdiAluno.update).not.toHaveBeenCalled();
  });

  it('cria PDI e registra auditoria', async () => {
    const { service, prisma, auditLogService } = criarService();

    const pdi = await service.create(
      {
        alunoId: 'aluno-1',
        professorResponsavelId: 'prof-1',
        titulo: ' PDI Ana ',
        objetivoGeral: ' Desenvolver autonomia ',
      },
      { sub: 'admin-1', role: Role.ADMIN } as never,
      auditUser as never,
    );

    expect(prisma.pdiAluno.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alunoId: 'aluno-1',
          professorResponsavelId: 'prof-1',
          titulo: 'PDI Ana',
          objetivoGeral: 'Desenvolver autonomia',
        }),
      }),
    );
    expect(pdi.id).toBe('pdi-1');
    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'PdiAluno',
        registroId: 'pdi-1',
      }),
    );
  });

  it('restringe listagem de professor aos alunos atendidos ou PDIs sob sua responsabilidade', async () => {
    const { service, prisma } = criarService();

    await service.findAll({}, { sub: 'prof-1', role: Role.PROFESSOR } as never);

    expect(prisma.pdiAluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {},
            expect.objectContaining({
              OR: expect.any(Array),
            }),
          ],
        }),
      }),
    );
  });
});
