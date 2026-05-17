import {
  AuditAcao,
  MatriculaStatus,
  MotivoEncerramentoMatricula,
  Role,
  StatusAcaoRiscoEvasao,
  StatusFrequencia,
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
      groupBy: jest.fn().mockResolvedValue([]),
    },
    turma: {
      count: jest.fn().mockResolvedValue(0),
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
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    frequencia: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    certificadoEmitido: {
      count: jest.fn().mockResolvedValue(0),
    },
    acaoRiscoEvasao: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
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

  it('busca opcoes de turma sob demanda sem carregar lista grande', async () => {
    const { service, prisma } = criarService();
    prisma.turma.findMany.mockResolvedValue([{ id: 'turma-1', nome: 'Braille Basico' }]);

    const opcoes = await service.opcoesTurmas('bra');

    expect(opcoes).toEqual([{ id: 'turma-1', label: 'Braille Basico' }]);
    expect(prisma.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          excluido: false,
          nome: { contains: 'bra', mode: 'insensitive' },
        },
        select: { id: true, nome: true },
        take: 20,
      }),
    );
  });

  it('nao consulta opcoes de alunos quando a busca e curta', async () => {
    const { service, prisma } = criarService();

    await expect(service.opcoesAlunos('a')).resolves.toEqual([]);

    expect(prisma.aluno.findMany).not.toHaveBeenCalled();
  });

  it('busca opcoes de alunos ativos e inativos nao excluidos', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.findMany.mockResolvedValue([{ id: 'aluno-1', nomeCompleto: 'Ana Silva', matricula: 'A001' }]);

    const opcoes = await service.opcoesAlunos('ana');

    expect(opcoes).toEqual([{ id: 'aluno-1', label: 'Ana Silva (A001)' }]);
    expect(prisma.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          excluido: false,
          OR: expect.arrayContaining([
            { nomeCompleto: { contains: 'ana', mode: 'insensitive' } },
            { matricula: { contains: 'ana', mode: 'insensitive' } },
          ]),
        }),
        take: 20,
      }),
    );
  });

  it('busca cidades existentes por prefixo', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.findMany.mockResolvedValue([{ cidade: 'Serra' }, { cidade: 'Serrana' }]);

    const opcoes = await service.opcoesCidades('ser');

    expect(opcoes).toEqual([
      { id: 'Serra', label: 'Serra' },
      { id: 'Serrana', label: 'Serrana' },
    ]);
    expect(prisma.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          excluido: false,
          cidade: { startsWith: 'ser', mode: 'insensitive' },
        },
        distinct: ['cidade'],
        select: { cidade: true },
        take: 20,
      }),
    );
  });

  it('busca bairros existentes refinando pela cidade selecionada', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.findMany.mockResolvedValue([{ bairro: 'Jardim Limoeiro' }]);

    const opcoes = await service.opcoesBairros('jar', 'Serra');

    expect(opcoes).toEqual([{ id: 'Jardim Limoeiro', label: 'Jardim Limoeiro' }]);
    expect(prisma.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          excluido: false,
          cidade: { equals: 'Serra', mode: 'insensitive' },
          bairro: { startsWith: 'jar', mode: 'insensitive' },
        },
        distinct: ['bairro'],
        select: { bairro: true },
        take: 20,
      }),
    );
  });

  it('gera resumo leve de alunos com contagens sem carregar a lista completa', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(6);

    const resumo = await service.alunosResumo({}, authAdmin as never);

    expect(resumo).toEqual({
      totalCadastrados: 7,
      ativos: 5,
      inativos: 2,
      comLaudo: 4,
      semLaudo: 3,
      precisamAcompanhante: 3,
      lgpdAceito: 6,
    });
    expect(prisma.aluno.findMany).not.toHaveBeenCalled();
  });

  it('gera distribuicoes de alunos em rankings limitados', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.groupBy
      .mockResolvedValueOnce([{ tipoDeficiencia: TipoDeficiencia.CEGUEIRA_TOTAL, _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ cidade: 'Serra', _count: { _all: 5 } }])
      .mockResolvedValueOnce([{ bairro: 'Jardim Limoeiro', _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ escolaridade: 'Ensino medio', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ rendaFamiliar: '1 salario', _count: { _all: 1 } }]);

    const distribuicoes = await service.alunosDistribuicoes({}, authAdmin as never);

    expect(distribuicoes).toEqual({
      porTipoDeficiencia: [{ label: TipoDeficiencia.CEGUEIRA_TOTAL, total: 3 }],
      porCidadeTop10: [{ label: 'Serra', total: 5 }],
      porBairroTop10: [{ label: 'Jardim Limoeiro', total: 4 }],
      porEscolaridadeTop10: [{ label: 'Ensino medio', total: 2 }],
      porRendaFamiliarTop10: [{ label: '1 salario', total: 1 }],
    });
    expect(prisma.aluno.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['cidade'],
        take: 10,
      }),
    );
  });

  it('pagina a lista detalhada de alunos e limita o tamanho da pagina', async () => {
    const { service, prisma } = criarService();
    const aluno = {
      id: 'aluno-1',
      matricula: 'A001',
      nomeCompleto: 'Ana Silva',
      statusAtivo: true,
    };
    prisma.aluno.count.mockResolvedValueOnce(120);
    prisma.aluno.findMany.mockResolvedValueOnce([aluno]);

    const lista = await service.alunosLista({ page: '2', limit: '500' }, authAdmin as never);

    expect(lista).toEqual({
      data: [aluno],
      meta: {
        page: 2,
        limit: 50,
        total: 120,
        lastPage: 3,
      },
    });
    expect(prisma.aluno.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        select: expect.not.objectContaining({ matriculasOficina: expect.anything() }),
      }),
    );
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

  it('gera consolidado institucional para PDF sem carregar listas detalhadas', async () => {
    const { service, prisma } = criarService();
    prisma.aluno.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.turma.groupBy.mockResolvedValueOnce([
      { status: TurmaStatus.ANDAMENTO, _count: { _all: 2 } },
      { status: TurmaStatus.CONCLUIDA, _count: { _all: 1 } },
    ]);
    prisma.aluno.groupBy
      .mockResolvedValueOnce([{ tipoDeficiencia: TipoDeficiencia.CEGUEIRA_TOTAL, _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ cidade: 'Serra', _count: { _all: 6 } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.matriculaOficina.groupBy
      .mockResolvedValueOnce([
        { status: MatriculaStatus.ATIVA, _count: { _all: 8 } },
        { status: MatriculaStatus.CONCLUIDA, _count: { _all: 3 } },
        { status: MatriculaStatus.EVADIDA, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { status: MatriculaStatus.EVADIDA, _count: { _all: 2 } },
        { status: MatriculaStatus.CANCELADA, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { motivoEncerramento: MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([{ turmaId: 'turma-1', _count: { _all: 2 } }]);
    prisma.turma.findMany.mockResolvedValueOnce([{ id: 'turma-1', nome: 'Braille Basico' }]);
    prisma.atendimentoIndividual.groupBy.mockResolvedValueOnce([
      { tipoRegistro: 'ATENDIMENTO_REALIZADO', _count: { _all: 5 } },
    ]);
    prisma.frequencia.groupBy.mockResolvedValueOnce([
      { status: StatusFrequencia.PRESENTE, _count: { _all: 9 } },
      { status: StatusFrequencia.FALTA, _count: { _all: 1 } },
    ]);

    const relatorio = await service.gerarConsolidadoInstitucional({}, authAdmin as never);

    expect(relatorio.alunos.porCidadeTop10).toEqual([{ label: 'Serra', total: 6 }]);
    expect(relatorio.evasoes.porMotivoTop10).toEqual([
      { label: MotivoEncerramentoMatricula.DIFICULDADE_TRANSPORTE, total: 2 },
    ]);
    expect(relatorio.evasoes.porTurmaTop10).toEqual([{ label: 'Braille Basico', total: 2 }]);
    expect(relatorio.atendimentos.total).toBe(5);
    expect(relatorio.frequencias).toEqual(
      expect.objectContaining({
        total: 10,
        presentes: 9,
        faltas: 1,
        taxaPresenca: 90,
      }),
    );
    expect(prisma.aluno.findMany).not.toHaveBeenCalled();
    expect(prisma.atendimentoIndividual.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['alunoId'],
        select: { alunoId: true },
      }),
    );
    expect(prisma.frequencia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['alunoId'],
        select: { alunoId: true },
      }),
    );
  });

  it('identifica alunos com risco de evasao por faltas e baixa presenca', async () => {
    const { service, prisma } = criarService();
    prisma.matriculaOficina.findMany.mockResolvedValueOnce([
      {
        id: 'mat-1',
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        aluno: {
          id: 'aluno-1',
          nomeCompleto: 'Ana Silva',
          matricula: 'A001',
          cidade: 'Serra',
          bairro: 'Centro',
        },
        turma: {
          id: 'turma-1',
          nome: 'Braille Basico',
          professor: { nome: 'Professora Ana' },
        },
      },
    ]);
    prisma.frequencia.findMany.mockResolvedValueOnce([
      { alunoId: 'aluno-1', turmaId: 'turma-1', dataAula: new Date('2026-05-30'), status: StatusFrequencia.FALTA },
      { alunoId: 'aluno-1', turmaId: 'turma-1', dataAula: new Date('2026-05-29'), status: StatusFrequencia.FALTA },
      { alunoId: 'aluno-1', turmaId: 'turma-1', dataAula: new Date('2026-05-28'), status: StatusFrequencia.FALTA },
      {
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        dataAula: new Date('2026-05-20'),
        status: StatusFrequencia.PRESENTE,
      },
    ]);
    prisma.atendimentoIndividual.findMany.mockResolvedValueOnce([]);
    prisma.acaoRiscoEvasao.findMany.mockResolvedValueOnce([
      {
        id: 'acao-1',
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        status: StatusAcaoRiscoEvasao.PENDENTE,
        prazo: new Date('2000-01-01T23:59:59.999Z'),
        responsavel: { nome: 'Secretaria' },
      },
    ]);
    prisma.acaoRiscoEvasao.count.mockResolvedValueOnce(1);

    const relatorio = await service.riscoEvasao({ dataFim: '2026-05-31' }, authAdmin as never);

    expect(relatorio.total).toBe(1);
    expect(relatorio.indicadores.alto).toBe(1);
    expect(relatorio.indicadores.tresFaltasSeguidas).toBe(1);
    expect(relatorio.indicadores.presencaAbaixo60).toBe(1);
    expect(relatorio.indicadores.acoesPendentes).toBe(1);
    expect(relatorio.indicadores.acoesVencidas).toBe(1);
    expect(relatorio.indicadores.acoesResolvidasNoMes).toBe(1);
    expect(relatorio.data[0]).toEqual(
      expect.objectContaining({
        alunoId: 'aluno-1',
        turma: 'Braille Basico',
        faltasSeguidas: 3,
        taxaPresenca: 25,
        nivel: 'ALTO',
        acaoAberta: {
          id: 'acao-1',
          status: StatusAcaoRiscoEvasao.PENDENTE,
          responsavel: 'Secretaria',
          prazo: '2000-01-01T23:59:59.999Z',
        },
      }),
    );
  });

  it('gera impacto social com comparativo de periodo anterior', async () => {
    const { service } = criarService();
    const metricasAtuais = {
      totalAlunosAtendidos: 10,
      totalAtendimentosIndividuais: 12,
      totalTurmasOfertadas: 4,
      totalCertificadosEmitidos: 3,
      totalAlunosDeficienciaVisualAtendidos: 9,
      totalBairrosAlcancados: 6,
      totalCidadesAlcancadas: 2,
      taxaPermanencia: 80,
      taxaConclusao: 50,
    };
    const metricasAnteriores = {
      totalAlunosAtendidos: 8,
      totalAtendimentosIndividuais: 10,
      totalTurmasOfertadas: 4,
      totalCertificadosEmitidos: 1,
      totalAlunosDeficienciaVisualAtendidos: 8,
      totalBairrosAlcancados: 3,
      totalCidadesAlcancadas: 2,
      taxaPermanencia: 70,
      taxaConclusao: 40,
    };
    jest
      .spyOn(service as any, 'calcularImpactoMetricas')
      .mockResolvedValueOnce(metricasAtuais as never)
      .mockResolvedValueOnce(metricasAnteriores as never);

    const relatorio = await service.impactoSocial(
      { dataInicio: '2026-05-01', dataFim: '2026-05-31' },
      authAdmin as never,
    );

    expect(relatorio.metricas.totalAlunosAtendidos).toBe(10);
    expect(relatorio.periodo.anterior).toEqual({ dataInicio: '2026-03-31', dataFim: '2026-04-30' });
    expect(relatorio.comparativo.totalAlunosAtendidos).toEqual({
      atual: 10,
      anterior: 8,
      variacaoPercentual: 25,
      direcao: 'SUBIU',
    });
    expect(relatorio.comparativo.taxaConclusao.variacaoPercentual).toBe(25);
  });

  it('exporta PDF institucional com filtros publicos para COMUNICACAO e registra auditoria', async () => {
    const { service, pdfExporter, auditLogService } = criarService();
    const relatorio = { emitidoEm: new Date().toISOString(), filtros: { statusAluno: 'TODOS' } };
    const gerarConsolidadoInstitucional = jest
      .spyOn(service, 'gerarConsolidadoInstitucional')
      .mockResolvedValue(relatorio as never);

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
    expect(gerarConsolidadoInstitucional).toHaveBeenCalledWith(
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
    const gerarConsolidado = jest.spyOn(service, 'gerarConsolidado').mockResolvedValue(relatorio as never);

    const buffer = await service.exportarXlsx(filtro, authAdmin as never, auditUser as never);

    expect(buffer).toEqual(Buffer.from('xlsx-test'));
    expect(gerarConsolidado).toHaveBeenCalledWith(filtro, authAdmin, { limiteDetalhes: 5000 });
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
