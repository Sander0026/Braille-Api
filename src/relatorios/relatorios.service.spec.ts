import {
  AuditAcao,
  MatriculaStatus,
  MotivoEncerramentoMatricula,
  Role,
  TipoDeficiencia,
  TurmaStatus,
} from '@prisma/client';
import { RelatoriosService } from './relatorios.service';

describe('RelatoriosService', () => {
  const authAdmin = { sub: 'admin-1', nome: 'Admin', email: 'admin@ilbes.org', role: Role.ADMIN };
  const auditUser = {
    sub: 'admin-1',
    nome: 'Admin',
    role: Role.ADMIN,
    ip: '127.0.0.1',
    userAgent: 'jest',
  };

  const criarPrisma = () => ({
    aluno: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    turma: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    matriculaOficina: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    acompanhamentoIndividual: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    atendimentoIndividual: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    frequencia: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  });

  const criarService = () => {
    const prisma = criarPrisma();
    const pdfExporter = {
      gerar: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')),
    };
    const xlsxExporter = {
      gerar: jest.fn().mockResolvedValue(Buffer.from('xlsx-test')),
    };
    const auditLogService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RelatoriosService(
      prisma as never,
      pdfExporter as never,
      xlsxExporter as never,
      auditLogService as never,
    );

    return { service, prisma, pdfExporter, xlsxExporter, auditLogService };
  };

  it('conta alunos, turmas por status e calcula evasao, conclusao e permanencia no resumo', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    prisma.turma.groupBy.mockResolvedValue([
      { status: TurmaStatus.PREVISTA, _count: { _all: 1 } },
      { status: TurmaStatus.ANDAMENTO, _count: { _all: 2 } },
      { status: TurmaStatus.CONCLUIDA, _count: { _all: 1 } },
      { status: TurmaStatus.CANCELADA, _count: { _all: 1 } },
    ]);
    prisma.matriculaOficina.groupBy.mockResolvedValue([
      { status: MatriculaStatus.ATIVA, _count: { _all: 10 } },
      { status: MatriculaStatus.CONCLUIDA, _count: { _all: 5 } },
      { status: MatriculaStatus.EVADIDA, _count: { _all: 2 } },
      { status: MatriculaStatus.CANCELADA, _count: { _all: 1 } },
      { status: MatriculaStatus.TRANSFERIDA, _count: { _all: 2 } },
    ]);

    const resumo = await service.resumo({}, authAdmin as never);

    expect(resumo.alunos).toEqual({
      total: 10,
      ativos: 7,
      inativos: 3,
      novosNoPeriodo: 2,
    });
    expect(resumo.turmas).toEqual({
      total: 5,
      previstas: 1,
      andamento: 2,
      concluidas: 1,
      canceladas: 1,
    });
    expect(resumo.matriculas).toEqual({
      total: 20,
      ativas: 10,
      concluidas: 5,
      evadidas: 2,
      canceladas: 1,
      transferidas: 2,
    });
    expect(resumo.indicadores).toEqual({
      taxaEvasao: 20,
      taxaConclusao: 50,
      taxaPermanencia: 50,
    });
  });

  it('aplica filtro por periodo nas contagens consolidadas', async () => {
    const { service, prisma } = criarService();

    await service.resumo({ dataInicio: '2026-05-01', dataFim: '2026-05-31' }, authAdmin as never);

    expect(prisma.aluno.count.mock.calls[3][0].where.criadoEm).toEqual({
      gte: new Date('2026-05-01T00:00:00.000Z'),
      lte: new Date('2026-05-31T23:59:59.999Z'),
    });
    expect(prisma.turma.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { dataInicio: expect.any(Object) },
                { criadoEm: expect.any(Object) },
              ],
            },
          ],
        }),
      }),
    );
    expect(prisma.matriculaOficina.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { dataEntrada: expect.any(Object) },
                { dataEncerramento: expect.any(Object) },
                { encerradoEm: expect.any(Object) },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('calcula ocupacao, evasao e conclusao por turma', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findMany.mockResolvedValue([
      {
        id: 'turma-1',
        nome: 'Braille Basico',
        descricao: null,
        status: TurmaStatus.ANDAMENTO,
        statusAtivo: true,
        dataInicio: new Date('2026-05-01T00:00:00.000Z'),
        dataFim: null,
        cargaHoraria: 40,
        capacidadeMaxima: 10,
        professor: { id: 'prof-1', nome: 'Professora Ana', matricula: 'P001' },
        matriculasOficina: [
          { id: 'm1', status: MatriculaStatus.ATIVA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm2', status: MatriculaStatus.ATIVA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm3', status: MatriculaStatus.ATIVA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm4', status: MatriculaStatus.ATIVA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm5', status: MatriculaStatus.CONCLUIDA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm6', status: MatriculaStatus.CONCLUIDA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm7', status: MatriculaStatus.CONCLUIDA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm8', status: MatriculaStatus.EVADIDA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm9', status: MatriculaStatus.EVADIDA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
          { id: 'm10', status: MatriculaStatus.CANCELADA, dataEntrada: new Date(), dataEncerramento: null, aluno: {} },
        ],
        _count: { frequencias: 0 },
      },
    ]);

    const relatorio = await service.turmas({}, authAdmin as never);

    expect(relatorio.indicadores).toEqual(
      expect.objectContaining({
        totalTurmas: 1,
        andamento: 1,
        totalVagas: 10,
        vagasOcupadas: 4,
        taxaMediaOcupacao: 40,
      }),
    );
    expect(relatorio.data[0].metricas).toEqual(
      expect.objectContaining({
        totalMatriculas: 10,
        matriculasAtivas: 4,
        matriculasConcluidas: 3,
        matriculasEvadidas: 2,
        matriculasCanceladas: 1,
        taxaOcupacao: 40,
        taxaEvasao: 20,
        taxaConclusao: 50,
      }),
    );
  });

  it('filtra relatorios de turmas pelo professor autenticado quando o perfil e PROFESSOR', async () => {
    const { service, prisma } = criarService();

    await service.turmas({ professorId: 'prof-outro' }, { sub: 'prof-1', role: Role.PROFESSOR } as never);

    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [{ professorId: 'prof-1' }, { professorAuxiliarId: 'prof-1' }],
            },
          ],
        }),
      }),
    );
  });

  it('filtra evasoes por turma, professor e motivo estruturado', async () => {
    const { service, prisma } = criarService();

    await service.evasoes(
      {
        turmaId: 'turma-1',
        professorId: 'prof-1',
        motivoEncerramento: MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE,
      },
      authAdmin as never,
    );

    expect(prisma.matriculaOficina.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          turmaId: 'turma-1',
          motivoEncerramento: MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE,
          status: {
            in: [MatriculaStatus.EVADIDA, MatriculaStatus.CANCELADA, MatriculaStatus.TRANSFERIDA],
          },
          turma: expect.objectContaining({
            id: 'turma-1',
            AND: [
              {
                OR: [{ professorId: 'prof-1' }, { professorAuxiliarId: 'prof-1' }],
              },
            ],
          }),
        }),
      }),
    );
  });

  it('calcula indicadores de evasao por motivo, turma, professor e permanencia', async () => {
    const { service, prisma } = criarService();
    prisma.matriculaOficina.findMany.mockResolvedValue([
      {
        id: 'm1',
        status: MatriculaStatus.EVADIDA,
        motivoEncerramento: MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE,
        observacao: 'Transporte',
        dataEntrada: new Date('2026-05-01T00:00:00.000Z'),
        dataEncerramento: new Date('2026-05-11T00:00:00.000Z'),
        encerradoEm: new Date('2026-05-11T10:00:00.000Z'),
        encerradoPorId: 'user-1',
        aluno: {
          id: 'aluno-1',
          nomeCompleto: 'Ana',
          matricula: 'A001',
          cidade: 'Santos',
          bairro: 'Centro',
          tipoDeficiencia: TipoDeficiencia.CEGUEIRA_TOTAL,
        },
        turma: {
          id: 'turma-1',
          nome: 'Braille Basico',
          status: TurmaStatus.ANDAMENTO,
          professor: { id: 'prof-1', nome: 'Professora Ana' },
        },
      },
      {
        id: 'm2',
        status: MatriculaStatus.EVADIDA,
        motivoEncerramento: MotivoEncerramentoMatricula.PROBLEMA_SAUDE,
        observacao: 'Saude',
        dataEntrada: new Date('2026-05-01T00:00:00.000Z'),
        dataEncerramento: new Date('2026-05-21T00:00:00.000Z'),
        encerradoEm: new Date('2026-05-21T10:00:00.000Z'),
        encerradoPorId: null,
        aluno: {
          id: 'aluno-2',
          nomeCompleto: 'Bruno',
          matricula: 'A002',
          cidade: 'Santos',
          bairro: 'Centro',
          tipoDeficiencia: TipoDeficiencia.BAIXA_VISAO,
        },
        turma: {
          id: 'turma-1',
          nome: 'Braille Basico',
          status: TurmaStatus.ANDAMENTO,
          professor: { id: 'prof-1', nome: 'Professora Ana' },
        },
      },
      {
        id: 'm3',
        status: MatriculaStatus.CANCELADA,
        motivoEncerramento: MotivoEncerramentoMatricula.CANCELAMENTO_DA_TURMA,
        observacao: 'Turma cancelada',
        dataEntrada: new Date('2026-05-01T00:00:00.000Z'),
        dataEncerramento: new Date('2026-05-06T00:00:00.000Z'),
        encerradoEm: new Date('2026-05-06T10:00:00.000Z'),
        encerradoPorId: null,
        aluno: {
          id: 'aluno-3',
          nomeCompleto: 'Carla',
          matricula: 'A003',
          cidade: 'Sao Vicente',
          bairro: 'Centro',
          tipoDeficiencia: null,
        },
        turma: {
          id: 'turma-2',
          nome: 'Informatica',
          status: TurmaStatus.CANCELADA,
          professor: { id: 'prof-2', nome: 'Professor Joao' },
        },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', nome: 'Secretaria', email: 'sec@ilbes.org' }]);

    const relatorio = await service.evasoes({}, authAdmin as never);

    expect(relatorio.totalEncerramentos).toBe(3);
    expect(relatorio.totalEvasoes).toBe(2);
    expect(relatorio.indicadores).toEqual(
      expect.objectContaining({
        totalEvasoes: 2,
        totalCancelamentos: 1,
        porTurma: { 'Braille Basico': 2 },
        porProfessor: { 'Professora Ana': 2 },
        porMotivo: {
          [MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE]: 1,
          [MotivoEncerramentoMatricula.PROBLEMA_SAUDE]: 1,
        },
        tempoMedioPermanenciaDias: 15,
      }),
    );
    expect(relatorio.data[0].registradoPor).toEqual(
      expect.objectContaining({ id: 'user-1', nome: 'Secretaria' }),
    );
  });

  it('exporta PDF institucional com filtros publicos para COMUNICACAO e registra auditoria', async () => {
    const { service, pdfExporter, auditLogService } = criarService();
    const relatorio = { emitidoEm: new Date().toISOString(), filtros: { statusAluno: 'TODOS' } };
    const gerarConsolidado = jest.spyOn(service, 'gerarConsolidado').mockResolvedValue(relatorio as never);

    const buffer = await service.exportarPdf(
      {
        dataInicio: '2026-05-01',
        dataFim: '2026-05-31',
        turmaId: 'turma-sensivel',
        professorId: 'prof-sensivel',
        alunoId: 'aluno-sensivel',
        statusAluno: 'ATIVO',
      },
      { sub: 'com-1', nome: 'Comunicacao', role: Role.COMUNICACAO } as never,
      { ...auditUser, sub: 'com-1', nome: 'Comunicacao', role: Role.COMUNICACAO } as never,
    );

    expect(buffer).toEqual(Buffer.from('%PDF-test'));
    expect(gerarConsolidado).toHaveBeenCalledWith(
      { dataInicio: '2026-05-01', dataFim: '2026-05-31', statusAluno: 'TODOS' },
      { sub: 'com-1', nome: 'Comunicacao', role: Role.COMUNICACAO },
    );
    expect(pdfExporter.gerar).toHaveBeenCalledWith(relatorio, {
      emissorNome: 'Comunicacao',
      emissorPerfil: Role.COMUNICACAO,
    });
    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'RelatorioInstitucional',
        acao: AuditAcao.DOWNLOAD,
        autorRole: Role.COMUNICACAO,
        newValue: expect.objectContaining({
          formato: 'PDF',
          filtros: { dataInicio: '2026-05-01', dataFim: '2026-05-31', statusAluno: 'TODOS' },
          observacaoLgpd: 'PDF institucional gerado somente com dados agregados.',
        }),
      }),
    );
  });

  it('exporta XLSX detalhado para perfil administrativo e registra auditoria', async () => {
    const { service, xlsxExporter, auditLogService } = criarService();
    const filtro = { turmaId: 'turma-1', motivoEncerramento: MotivoEncerramentoMatricula.FALTA_DE_CONTATO };
    const relatorio = { emitidoEm: new Date().toISOString(), filtros: filtro };
    jest.spyOn(service, 'gerarConsolidado').mockResolvedValue(relatorio as never);

    const buffer = await service.exportarXlsx(filtro, authAdmin as never, auditUser as never);

    expect(buffer).toEqual(Buffer.from('xlsx-test'));
    expect(xlsxExporter.gerar).toHaveBeenCalledWith(relatorio);
    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'RelatorioInstitucional',
        acao: AuditAcao.DOWNLOAD,
        autorRole: Role.ADMIN,
        newValue: expect.objectContaining({
          formato: 'XLSX',
          filtros: {
            turmaId: 'turma-1',
            motivoEncerramento: MotivoEncerramentoMatricula.FALTA_DE_CONTATO,
          },
          observacaoLgpd: 'XLSX detalhado restrito a perfis administrativos.',
        }),
      }),
    );
  });
});
