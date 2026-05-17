import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MatriculaStatus,
  MotivoEncerramentoMatricula,
  Prisma,
  Role,
  StatusFrequencia,
  TipoDeficiencia,
  TipoRegistroAtendimentoIndividual,
  TurmaStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { FiltroRelatorioAlunosDto } from './dto/filtro-relatorio-alunos.dto';
import { FiltroRelatorioAtendimentosDto } from './dto/filtro-relatorio-atendimentos.dto';
import { FiltroRelatorioEvasoesDto } from './dto/filtro-relatorio-evasoes.dto';
import {
  FiltroRelatorioGeralDto,
  STATUS_ALUNO_RELATORIO,
  StatusAlunoRelatorio,
} from './dto/filtro-relatorio-geral.dto';
import { FiltroRelatorioTurmasDto } from './dto/filtro-relatorio-turmas.dto';
import { RelatorioInstitucionalPdfService } from './exporters/relatorio-institucional-pdf.service';
import { RelatorioInstitucionalXlsxService } from './exporters/relatorio-institucional-xlsx.service';

type PeriodoRelatorio = {
  inicio?: Date;
  fim?: Date;
};

type ResumoRelatorio = {
  alunos: {
    total: number;
    ativos: number;
    inativos: number;
    novosNoPeriodo: number;
  };
  turmas: {
    total: number;
    previstas: number;
    andamento: number;
    concluidas: number;
    canceladas: number;
  };
  matriculas: {
    total: number;
    ativas: number;
    concluidas: number;
    evadidas: number;
    canceladas: number;
    transferidas: number;
  };
  indicadores: {
    taxaEvasao: number;
    taxaConclusao: number;
    taxaPermanencia: number;
  };
};

type RelatorioExportacao = {
  emitidoEm: string;
  filtros: FiltroRelatorioGeralDto;
  resumo: ResumoRelatorio;
  alunos: Awaited<ReturnType<RelatoriosService['alunos']>>;
  turmas: Awaited<ReturnType<RelatoriosService['turmas']>>;
  evasoes: Awaited<ReturnType<RelatoriosService['evasoes']>>;
  atendimentos: Awaited<ReturnType<RelatoriosService['atendimentos']>>;
  frequencias: Awaited<ReturnType<RelatoriosService['frequencias']>>;
};

const STATUS_MATRICULA_ENCERRADA = [
  MatriculaStatus.CONCLUIDA,
  MatriculaStatus.EVADIDA,
  MatriculaStatus.CANCELADA,
  MatriculaStatus.TRANSFERIDA,
] as const;

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExporter: RelatorioInstitucionalPdfService,
    private readonly xlsxExporter: RelatorioInstitucionalXlsxService,
  ) {}

  async resumo(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<ResumoRelatorio> {
    this.validarPeriodo(filtro);

    const alunoWhere = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: false });
    const alunoNovoWhere = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const turmaWhere = this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: true });
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, { aplicarPeriodo: true });

    const [totalAlunos, alunosAtivos, alunosInativos, novosNoPeriodo, turmasPorStatus, matriculasPorStatus] =
      await this.prisma.$transaction([
        this.prisma.aluno.count({ where: alunoWhere }),
        this.prisma.aluno.count({ where: { ...alunoWhere, statusAtivo: true } }),
        this.prisma.aluno.count({ where: { ...alunoWhere, statusAtivo: false } }),
        this.prisma.aluno.count({ where: alunoNovoWhere }),
        this.prisma.turma.groupBy({
          by: ['status'],
          where: turmaWhere,
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.matriculaOficina.groupBy({
          by: ['status'],
          where: matriculaWhere,
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
      ]);

    const turmas = this.contagensPorChave<TurmaStatus>(turmasPorStatus, 'status');
    const matriculas = this.contagensPorChave<MatriculaStatus>(matriculasPorStatus, 'status');

    const totalTurmas = this.somarContagens(turmas);
    const totalMatriculas = this.somarContagens(matriculas);
    const ativas = matriculas[MatriculaStatus.ATIVA] ?? 0;
    const concluidas = matriculas[MatriculaStatus.CONCLUIDA] ?? 0;
    const evadidas = matriculas[MatriculaStatus.EVADIDA] ?? 0;
    const canceladas = matriculas[MatriculaStatus.CANCELADA] ?? 0;
    const transferidas = matriculas[MatriculaStatus.TRANSFERIDA] ?? 0;
    const encerradas = concluidas + evadidas + canceladas + transferidas;

    return {
      alunos: {
        total: totalAlunos,
        ativos: alunosAtivos,
        inativos: alunosInativos,
        novosNoPeriodo,
      },
      turmas: {
        total: totalTurmas,
        previstas: turmas[TurmaStatus.PREVISTA] ?? 0,
        andamento: turmas[TurmaStatus.ANDAMENTO] ?? 0,
        concluidas: turmas[TurmaStatus.CONCLUIDA] ?? 0,
        canceladas: turmas[TurmaStatus.CANCELADA] ?? 0,
      },
      matriculas: {
        total: totalMatriculas,
        ativas,
        concluidas,
        evadidas,
        canceladas,
        transferidas,
      },
      indicadores: {
        taxaEvasao: this.percentual(evadidas, encerradas),
        taxaConclusao: this.percentual(concluidas, encerradas),
        taxaPermanencia: this.percentual(ativas, totalMatriculas),
      },
    };
  }

  async alunos(filtro: FiltroRelatorioAlunosDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: false,
      incluirAluno: false,
    });

    const alunos = await this.prisma.aluno.findMany({
      where,
      select: {
        id: true,
        matricula: true,
        nomeCompleto: true,
        dataNascimento: true,
        cpf: true,
        telefoneContato: true,
        cidade: true,
        bairro: true,
        tipoDeficiencia: true,
        causaDeficiencia: true,
        prefAcessibilidade: true,
        possuiLaudo: true,
        laudoUrl: true,
        escolaridade: true,
        rendaFamiliar: true,
        beneficiosGov: true,
        precisaAcompanhante: true,
        termoLgpdAceito: true,
        statusAtivo: true,
        criadoEm: true,
        matriculasOficina: {
          where: matriculaWhere,
          select: {
            id: true,
            status: true,
            dataEntrada: true,
            dataEncerramento: true,
            motivoEncerramento: true,
            turma: {
              select: {
                id: true,
                nome: true,
                status: true,
              },
            },
          },
          orderBy: { dataEntrada: 'desc' },
        },
      },
      orderBy: { nomeCompleto: 'asc' },
    });

    const ativos = alunos.filter((aluno) => aluno.statusAtivo).length;
    const inativos = alunos.filter((aluno) => !aluno.statusAtivo).length;
    const comLaudo = alunos.filter((aluno) => aluno.possuiLaudo || Boolean(aluno.laudoUrl)).length;
    const recebemBeneficioGov = alunos.filter((aluno) => this.temTexto(aluno.beneficiosGov)).length;
    const precisamAcompanhante = alunos.filter((aluno) => aluno.precisaAcompanhante).length;
    const lgpdAceito = alunos.filter((aluno) => aluno.termoLgpdAceito).length;

    return {
      filtros: filtro,
      total: alunos.length,
      indicadores: {
        totalCadastrados: alunos.length,
        ativos,
        inativos,
        cadastradosNoPeriodo: alunos.length,
        porTipoDeficiencia: this.agruparPor(alunos, (aluno) => aluno.tipoDeficiencia ?? 'Nao informado'),
        porCausaDeficiencia: this.agruparPor(alunos, (aluno) => aluno.causaDeficiencia ?? 'Nao informado'),
        porPreferenciaAcessibilidade: this.agruparPor(
          alunos,
          (aluno) => aluno.prefAcessibilidade ?? 'Nao informado',
        ),
        porCidade: this.agruparPor(alunos, (aluno) => aluno.cidade ?? 'Nao informado'),
        porBairro: this.agruparPor(alunos, (aluno) => aluno.bairro ?? 'Nao informado'),
        porEscolaridade: this.agruparPor(alunos, (aluno) => aluno.escolaridade ?? 'Nao informado'),
        porRendaFamiliar: this.agruparPor(alunos, (aluno) => aluno.rendaFamiliar ?? 'Nao informado'),
        recebemBeneficioGov,
        precisamAcompanhante,
        comLaudo,
        semLaudo: alunos.length - comLaudo,
        lgpdAceito,
      },
      porStatus: {
        ativos,
        inativos,
      },
      porCidade: this.agruparPor(alunos, (aluno) => aluno.cidade ?? 'Nao informado'),
      porTipoDeficiencia: this.agruparPor(alunos, (aluno) => aluno.tipoDeficiencia ?? 'Nao informado'),
      data: alunos,
    };
  }

  async turmas(filtro: FiltroRelatorioTurmasDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: true });
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: false,
      incluirTurma: false,
    });

    const turmas = await this.prisma.turma.findMany({
      where,
      select: {
        id: true,
        nome: true,
        descricao: true,
        status: true,
        statusAtivo: true,
        dataInicio: true,
        dataFim: true,
        cargaHoraria: true,
        capacidadeMaxima: true,
        professor: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
        matriculasOficina: {
          where: matriculaWhere,
          select: {
            id: true,
            status: true,
            dataEntrada: true,
            dataEncerramento: true,
            motivoEncerramento: true,
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
                matricula: true,
              },
            },
          },
          orderBy: { dataEntrada: 'desc' },
        },
        _count: {
          select: {
            frequencias: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
    });

    const data = turmas.map((turma) => {
      const matriculasResumo = this.agruparPor(turma.matriculasOficina, (matricula) => matricula.status);
      const matriculasAtivas = matriculasResumo[MatriculaStatus.ATIVA] ?? 0;
      const matriculasConcluidas = matriculasResumo[MatriculaStatus.CONCLUIDA] ?? 0;
      const matriculasEvadidas = matriculasResumo[MatriculaStatus.EVADIDA] ?? 0;
      const matriculasCanceladas = matriculasResumo[MatriculaStatus.CANCELADA] ?? 0;
      const matriculasTransferidas = matriculasResumo[MatriculaStatus.TRANSFERIDA] ?? 0;
      const totalMatriculas = turma.matriculasOficina.length;
      const totalEncerradas =
        matriculasConcluidas + matriculasEvadidas + matriculasCanceladas + matriculasTransferidas;

      return {
        ...turma,
        matriculasResumo,
        metricas: {
          totalMatriculas,
          matriculasAtivas,
          matriculasConcluidas,
          matriculasEvadidas,
          matriculasCanceladas,
          matriculasTransferidas,
          totalEncerradas,
          taxaOcupacao: this.percentual(matriculasAtivas, turma.capacidadeMaxima ?? 0),
          taxaEvasao: this.percentual(matriculasEvadidas, totalMatriculas),
          taxaConclusao: this.percentual(matriculasConcluidas, totalEncerradas),
        },
      };
    });

    const porStatus = this.agruparPor(data, (turma) => turma.status);
    const totalVagas = data.reduce((total, turma) => total + (turma.capacidadeMaxima ?? 0), 0);
    const vagasOcupadas = data.reduce((total, turma) => total + turma.metricas.matriculasAtivas, 0);

    return {
      filtros: filtro,
      total: data.length,
      indicadores: {
        totalTurmas: data.length,
        previstas: porStatus[TurmaStatus.PREVISTA] ?? 0,
        andamento: porStatus[TurmaStatus.ANDAMENTO] ?? 0,
        concluidas: porStatus[TurmaStatus.CONCLUIDA] ?? 0,
        canceladas: porStatus[TurmaStatus.CANCELADA] ?? 0,
        arquivadas: data.filter((turma) => !turma.statusAtivo).length,
        totalVagas,
        vagasOcupadas,
        taxaMediaOcupacao: this.percentual(vagasOcupadas, totalVagas),
        alunosMatriculadosPorTurma: data.map((turma) => ({
          turmaId: turma.id,
          turma: turma.nome,
          totalMatriculas: turma.metricas.totalMatriculas,
        })),
      },
      porStatus,
      data,
    };
  }

  async evasoes(filtro: FiltroRelatorioEvasoesDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const statusPadrao = filtro.statusMatricula ? undefined : [...STATUS_MATRICULA_ENCERRADA];
    const where = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: true,
      statusPadrao,
      periodoCampos: ['dataEncerramento', 'encerradoEm'],
    });

    const matriculas = await this.prisma.matriculaOficina.findMany({
      where,
      select: {
        id: true,
        status: true,
        motivoEncerramento: true,
        observacao: true,
        dataEntrada: true,
        dataEncerramento: true,
        encerradoEm: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            matricula: true,
            cidade: true,
            bairro: true,
            tipoDeficiencia: true,
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            status: true,
            professor: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
      orderBy: [{ encerradoEm: 'desc' }, { dataEncerramento: 'desc' }],
    });

    return {
      filtros: filtro,
      totalEncerramentos: matriculas.length,
      totalEvasoes: matriculas.filter((matricula) => matricula.status === MatriculaStatus.EVADIDA).length,
      porStatus: this.agruparPor(matriculas, (matricula) => matricula.status),
      porMotivo: this.agruparPor(matriculas, (matricula) => matricula.motivoEncerramento ?? 'Nao informado'),
      data: matriculas,
    };
  }

  async atendimentos(filtro: FiltroRelatorioAtendimentosDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAtendimento(filtro, authUser);

    const atendimentos = await this.prisma.atendimentoIndividual.findMany({
      where,
      select: {
        id: true,
        dataAtendimento: true,
        horaInicioMinutos: true,
        horaFimMinutos: true,
        duracaoMinutos: true,
        modalidade: true,
        localAtendimento: true,
        tipoRegistro: true,
        assuntoDoDia: true,
        observacao: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            matricula: true,
            cidade: true,
            bairro: true,
            tipoDeficiencia: true,
          },
        },
        professor: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
        acompanhamento: {
          select: {
            id: true,
            assuntoAtual: true,
            status: true,
          },
        },
      },
      orderBy: [{ dataAtendimento: 'desc' }, { criadoEm: 'desc' }],
    });

    return {
      filtros: filtro,
      total: atendimentos.length,
      porTipoRegistro: this.agruparPor(atendimentos, (atendimento) => atendimento.tipoRegistro),
      data: atendimentos,
    };
  }

  async frequencias(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereFrequencia(filtro, authUser);

    const frequencias = await this.prisma.frequencia.findMany({
      where,
      select: {
        id: true,
        dataAula: true,
        status: true,
        observacao: true,
        fechado: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            matricula: true,
            cidade: true,
            bairro: true,
            tipoDeficiencia: true,
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            status: true,
            professor: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
      orderBy: [{ dataAula: 'desc' }],
    });

    const presentes = frequencias.filter((frequencia) => frequencia.status === StatusFrequencia.PRESENTE).length;
    const faltas = frequencias.filter((frequencia) => frequencia.status === StatusFrequencia.FALTA).length;
    const faltasJustificadas = frequencias.filter(
      (frequencia) => frequencia.status === StatusFrequencia.FALTA_JUSTIFICADA,
    ).length;

    return {
      filtros: filtro,
      total: frequencias.length,
      presentes,
      faltas,
      faltasJustificadas,
      taxaPresenca: this.percentual(presentes, frequencias.length),
      porStatus: this.agruparPor(frequencias, (frequencia) => frequencia.status),
      data: frequencias,
    };
  }

  async gerarConsolidado(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<RelatorioExportacao> {
    const [resumo, alunos, turmas, evasoes, atendimentos, frequencias] = await Promise.all([
      this.resumo(filtro, authUser),
      this.alunos(filtro, authUser),
      this.turmas(filtro, authUser),
      this.evasoes(filtro, authUser),
      this.atendimentos(filtro, authUser),
      this.frequencias(filtro, authUser),
    ]);

    return {
      emitidoEm: new Date().toISOString(),
      filtros: filtro,
      resumo,
      alunos,
      turmas,
      evasoes,
      atendimentos,
      frequencias,
    };
  }

  async exportarPdf(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<Buffer> {
    const relatorio = await this.gerarConsolidado(filtro, authUser);
    return this.pdfExporter.gerar(relatorio, {
      emissorNome: authUser?.nome || authUser?.email || authUser?.sub,
      emissorPerfil: authUser?.role,
    });
  }

  async exportarXlsx(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<Buffer> {
    const relatorio = await this.gerarConsolidado(filtro, authUser);
    return this.xlsxExporter.gerar(relatorio);
  }

  private montarWhereAluno(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
    options: { aplicarPeriodo: boolean },
  ): Prisma.AlunoWhereInput {
    const where = this.montarWhereAlunoBasico(filtro, { aplicarPeriodo: options.aplicarPeriodo });

    if (this.deveFiltrarAlunoPorMatricula(filtro, authUser)) {
      where.matriculasOficina = {
        some: this.montarWhereMatricula(filtro, authUser, {
          aplicarPeriodo: false,
          incluirAluno: false,
        }),
      };
    }

    return where;
  }

  private montarWhereAlunoBasico(
    filtro: FiltroRelatorioGeralDto,
    options: { aplicarPeriodo: boolean; ignorarAlunoId?: boolean },
  ): Prisma.AlunoWhereInput {
    const where: Prisma.AlunoWhereInput = { excluido: false };
    const statusAluno = this.normalizarStatusAluno(filtro.statusAluno);
    const tipoDeficiencia = this.normalizarEnum(TipoDeficiencia, filtro.tipoDeficiencia, 'tipoDeficiencia');
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);

    if (filtro.alunoId && !options.ignorarAlunoId) {
      where.id = filtro.alunoId;
    }

    if (statusAluno === 'ATIVO') {
      where.statusAtivo = true;
    } else if (statusAluno === 'INATIVO') {
      where.statusAtivo = false;
    }

    if (filtro.cidade) {
      where.cidade = { contains: filtro.cidade, mode: Prisma.QueryMode.insensitive };
    }

    if (filtro.bairro) {
      where.bairro = { contains: filtro.bairro, mode: Prisma.QueryMode.insensitive };
    }

    if (tipoDeficiencia) {
      where.tipoDeficiencia = tipoDeficiencia;
    }

    if (options.aplicarPeriodo && range) {
      where.criadoEm = range;
    }

    return where;
  }

  private montarWhereTurma(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
    options: { aplicarPeriodo?: boolean } = {},
  ): Prisma.TurmaWhereInput {
    const where: Prisma.TurmaWhereInput = { excluido: false };
    const and: Prisma.TurmaWhereInput[] = [];
    const statusTurma = this.normalizarEnum(TurmaStatus, filtro.statusTurma, 'statusTurma');
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);

    if (filtro.turmaId) {
      where.id = filtro.turmaId;
    }

    if (statusTurma) {
      where.status = statusTurma;
    }

    const professorId = authUser?.role === Role.PROFESSOR ? authUser.sub : filtro.professorId;
    if (professorId) {
      and.push({
        OR: [{ professorId }, { professorAuxiliarId: professorId }],
      });
    }

    if (options.aplicarPeriodo && range) {
      and.push({
        OR: [{ dataInicio: range }, { criadoEm: range }],
      });
    }

    if (and.length) {
      where.AND = and;
    }

    return where;
  }

  private montarWhereMatricula(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
    options: {
      aplicarPeriodo: boolean;
      incluirAluno?: boolean;
      incluirTurma?: boolean;
      statusPadrao?: MatriculaStatus[];
      periodoCampos?: Array<'dataEntrada' | 'dataEncerramento' | 'encerradoEm' | 'criadoEm'>;
    },
  ): Prisma.MatriculaOficinaWhereInput {
    const where: Prisma.MatriculaOficinaWhereInput = {};
    const and: Prisma.MatriculaOficinaWhereInput[] = [];
    const status = this.normalizarEnum(MatriculaStatus, filtro.statusMatricula, 'statusMatricula');
    const motivo = this.normalizarEnum(MotivoEncerramentoMatricula, filtro.motivoEncerramento, 'motivoEncerramento');
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);

    if (filtro.alunoId) {
      where.alunoId = filtro.alunoId;
    }

    if (filtro.turmaId) {
      where.turmaId = filtro.turmaId;
    }

    if (status) {
      where.status = status;
    } else if (options.statusPadrao?.length) {
      where.status = { in: options.statusPadrao };
    }

    if (motivo) {
      where.motivoEncerramento = motivo;
    }

    if (options.incluirAluno !== false) {
      where.aluno = this.montarWhereAlunoBasico(filtro, {
        aplicarPeriodo: false,
        ignorarAlunoId: true,
      });
    }

    if (options.incluirTurma !== false) {
      where.turma = this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: false });
    }

    if (options.aplicarPeriodo && range) {
      const campos = options.periodoCampos ?? ['dataEntrada', 'dataEncerramento', 'encerradoEm'];
      and.push({
        OR: campos.map((campo) => ({ [campo]: range }) as Prisma.MatriculaOficinaWhereInput),
      });
    }

    if (and.length) {
      where.AND = and;
    }

    return where;
  }

  private montarWhereAtendimento(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
  ): Prisma.AtendimentoIndividualWhereInput {
    const where: Prisma.AtendimentoIndividualWhereInput = {
      excluidoEm: null,
      aluno: this.montarWhereAlunoBasico(filtro, { aplicarPeriodo: false, ignorarAlunoId: true }),
    };
    const and: Prisma.AtendimentoIndividualWhereInput[] = [];
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);

    if (filtro.alunoId) {
      where.alunoId = filtro.alunoId;
    }

    if (range) {
      where.dataAtendimento = range;
    }

    if (authUser?.role === Role.PROFESSOR) {
      where.professorId = authUser.sub;
    } else if (filtro.professorId) {
      where.professorId = filtro.professorId;
    }

    if (this.deveFiltrarAtendimentoPorMatricula(filtro)) {
      and.push({
        aluno: {
          matriculasOficina: {
            some: this.montarWhereMatricula(filtro, authUser, {
              aplicarPeriodo: false,
              incluirAluno: false,
            }),
          },
        },
      });
    }

    if (and.length) {
      where.AND = and;
    }

    return where;
  }

  private montarWhereFrequencia(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
  ): Prisma.FrequenciaWhereInput {
    const where: Prisma.FrequenciaWhereInput = {
      aluno: this.montarWhereAlunoBasico(filtro, { aplicarPeriodo: false, ignorarAlunoId: true }),
      turma: this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: false }),
    };
    const and: Prisma.FrequenciaWhereInput[] = [];
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);

    if (filtro.alunoId) {
      where.alunoId = filtro.alunoId;
    }

    if (filtro.turmaId) {
      where.turmaId = filtro.turmaId;
    }

    if (range) {
      where.dataAula = range;
    }

    if (this.deveFiltrarFrequenciaPorMatricula(filtro)) {
      and.push({
        aluno: {
          matriculasOficina: {
            some: this.montarWhereMatricula(filtro, authUser, {
              aplicarPeriodo: false,
              incluirAluno: false,
            }),
          },
        },
      });
    }

    if (and.length) {
      where.AND = and;
    }

    return where;
  }

  private deveFiltrarAlunoPorMatricula(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): boolean {
    return Boolean(
      authUser?.role === Role.PROFESSOR ||
      filtro.turmaId ||
      filtro.professorId ||
      filtro.statusTurma ||
      filtro.statusMatricula ||
      filtro.motivoEncerramento,
    );
  }

  private deveFiltrarAtendimentoPorMatricula(filtro: FiltroRelatorioGeralDto): boolean {
    return Boolean(filtro.turmaId || filtro.statusTurma || filtro.statusMatricula || filtro.motivoEncerramento);
  }

  private deveFiltrarFrequenciaPorMatricula(filtro: FiltroRelatorioGeralDto): boolean {
    return Boolean(filtro.statusMatricula || filtro.motivoEncerramento);
  }

  private validarPeriodo(filtro: FiltroRelatorioGeralDto): void {
    const { inicio, fim } = this.obterPeriodo(filtro);
    if (inicio && fim && inicio.getTime() > fim.getTime()) {
      throw new BadRequestException('dataInicio deve ser menor ou igual a dataFim.');
    }
  }

  private obterPeriodo(filtro: Pick<FiltroRelatorioGeralDto, 'dataInicio' | 'dataFim'>): PeriodoRelatorio {
    return {
      inicio: filtro.dataInicio ? this.parseDate(filtro.dataInicio, false) : undefined,
      fim: filtro.dataFim ? this.parseDate(filtro.dataFim, true) : undefined,
    };
  }

  private montarRange(periodo: PeriodoRelatorio): Prisma.DateTimeFilter | undefined {
    if (!periodo.inicio && !periodo.fim) return undefined;
    return {
      ...(periodo.inicio && { gte: periodo.inicio }),
      ...(periodo.fim && { lte: periodo.fim }),
    };
  }

  private parseDate(value: string, fimDoDia: boolean): Date {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const normalized = isDateOnly ? `${value}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}Z` : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data invalida.');
    }
    return date;
  }

  private normalizarStatusAluno(status?: string): StatusAlunoRelatorio {
    const normalized = (status ?? 'TODOS').toUpperCase();
    if (!STATUS_ALUNO_RELATORIO.includes(normalized as StatusAlunoRelatorio)) {
      throw new BadRequestException('statusAluno invalido.');
    }
    return normalized as StatusAlunoRelatorio;
  }

  private normalizarEnum<T extends Record<string, string>>(
    enumObject: T,
    value: string | undefined,
    field: string,
  ): T[keyof T] | undefined {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    const found = Object.values(enumObject).find((item) => item === normalized);
    if (!found) {
      throw new BadRequestException(`${field} invalido.`);
    }
    return found as T[keyof T];
  }

  private contagensPorChave<T extends string>(
    grupos: Array<Record<string, unknown> & { _count?: true | Record<string, number | undefined> }>,
    chave: string,
  ): Record<T, number> {
    return grupos.reduce(
      (acc, grupo) => {
        const key = String(grupo[chave]) as T;
        acc[key] = typeof grupo._count === 'object' ? (grupo._count._all ?? 0) : 0;
        return acc;
      },
      {} as Record<T, number>,
    );
  }

  private agruparPor<T>(items: T[], resolver: (item: T) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = resolver(item) || 'Nao informado';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private somarContagens<T extends string>(record: Partial<Record<T, number>>): number {
    let total = 0;
    for (const value of Object.values(record as Record<string, number | undefined>)) {
      total += value ?? 0;
    }
    return total;
  }

  private percentual(parte: number, total: number): number {
    if (!total) return 0;
    return Number(((parte / total) * 100).toFixed(2));
  }

  private temTexto(value?: string | null): boolean {
    return Boolean(value?.trim());
  }
}

export type { RelatorioExportacao, ResumoRelatorio };
