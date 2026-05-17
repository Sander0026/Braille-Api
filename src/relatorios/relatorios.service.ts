import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditAcao,
  MatriculaStatus,
  MotivoEncerramentoMatricula,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  StatusFrequencia,
  TipoDeficiencia,
  TipoRegistroAtendimentoIndividual,
  TurmaStatus,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuditUser } from '../common/interfaces/audit-user.interface';
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

type AcompanhamentoEvasao = {
  alunoId: string;
  status: StatusAcompanhamentoIndividual;
  arquivado: boolean;
  atendimentos: Array<{
    tipoRegistro: TipoRegistroAtendimentoIndividual;
    dataAtendimento: Date;
  }>;
};

const STATUS_MATRICULA_ENCERRADA = [
  MatriculaStatus.CONCLUIDA,
  MatriculaStatus.EVADIDA,
  MatriculaStatus.CANCELADA,
  MatriculaStatus.TRANSFERIDA,
] as const;

const STATUS_RELATORIO_EVASOES = [
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
    private readonly auditLogService: AuditLogService,
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
    const statusPadrao = filtro.statusMatricula ? undefined : [...STATUS_RELATORIO_EVASOES];
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
        encerradoPorId: true,
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

    const encerradoPorIds = [
      ...new Set(matriculas.map((matricula) => matricula.encerradoPorId).filter(Boolean)),
    ] as string[];
    const usuarios = encerradoPorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: encerradoPorIds } },
          select: {
            id: true,
            nome: true,
            email: true,
            matricula: true,
          },
        })
      : [];
    const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
    const alunoIds = [...new Set(matriculas.map((matricula) => matricula.aluno.id))];
    const acompanhamentos = alunoIds.length
      ? await this.prisma.acompanhamentoIndividual.findMany({
          where: {
            excluidoEm: null,
            alunoId: { in: alunoIds },
          },
          select: {
            alunoId: true,
            status: true,
            arquivado: true,
            atendimentos: {
              where: { excluidoEm: null },
              select: {
                tipoRegistro: true,
                dataAtendimento: true,
              },
            },
          },
        })
      : [];
    const acompanhamentosPorAluno = this.agruparAcompanhamentosPorAluno(acompanhamentos);

    const data = matriculas.map((matricula) => {
      const dataSaida = matricula.dataEncerramento ?? matricula.encerradoEm;

      return {
        ...matricula,
        dataSaida,
        tempoPermanenciaDias: this.diasEntre(matricula.dataEntrada, dataSaida),
        atendimentosIndividuais: this.resumirAtendimentosIndividuais(
          matricula.aluno.id,
          dataSaida,
          acompanhamentosPorAluno,
        ),
        registradoPor: matricula.encerradoPorId ? (usuariosPorId.get(matricula.encerradoPorId) ?? null) : null,
      };
    });
    const evasoes = data.filter((matricula) => matricula.status === MatriculaStatus.EVADIDA);
    const porTurma = this.agruparPor(evasoes, (matricula) => matricula.turma.nome);
    const porProfessor = this.agruparPor(
      evasoes,
      (matricula) => matricula.turma.professor?.nome ?? 'Nao informado',
    );
    const porMotivo = this.agruparPor(
      evasoes,
      (matricula) => matricula.motivoEncerramento ?? 'Sem motivo estruturado',
    );

    return {
      filtros: filtro,
      totalEncerramentos: data.length,
      totalEvasoes: evasoes.length,
      indicadores: {
        totalEvasoes: evasoes.length,
        totalCancelamentos: data.filter((matricula) => matricula.status === MatriculaStatus.CANCELADA).length,
        totalTransferencias: data.filter((matricula) => matricula.status === MatriculaStatus.TRANSFERIDA).length,
        semMotivoEstruturado: evasoes.filter((matricula) => !matricula.motivoEncerramento).length,
        evasoesComAtendimentoIndividual: evasoes.filter(
          (matricula) => matricula.atendimentosIndividuais.possuiAtendimento,
        ).length,
        evasoesSemAtendimentoIndividual: evasoes.filter(
          (matricula) => !matricula.atendimentosIndividuais.possuiAtendimento,
        ).length,
        evasoesComFaltasEmAtendimento: evasoes.filter(
          (matricula) =>
            matricula.atendimentosIndividuais.faltasJustificadas +
              matricula.atendimentosIndividuais.faltasNaoJustificadas >
            0,
        ).length,
        evasoesComAcompanhamentoFinalizado: evasoes.filter(
          (matricula) => matricula.atendimentosIndividuais.acompanhamentosFinalizados > 0,
        ).length,
        evasoesComAcompanhamentoArquivado: evasoes.filter(
          (matricula) => matricula.atendimentosIndividuais.acompanhamentosArquivados > 0,
        ).length,
        porTurma,
        porProfessor,
        porMes: this.agruparPor(evasoes, (matricula) => this.chaveMes(matricula.dataSaida ?? matricula.encerradoEm)),
        porMotivo,
        porTipoDeficiencia: this.agruparPor(
          evasoes,
          (matricula) => matricula.aluno.tipoDeficiencia ?? 'Nao informado',
        ),
        porCidade: this.agruparPor(evasoes, (matricula) => matricula.aluno.cidade ?? 'Nao informado'),
        porBairro: this.agruparPor(evasoes, (matricula) => matricula.aluno.bairro ?? 'Nao informado'),
        porCidadeBairro: this.agruparPor(evasoes, (matricula) =>
          [matricula.aluno.cidade, matricula.aluno.bairro].filter(Boolean).join(' / ') || 'Nao informado',
        ),
        tempoMedioPermanenciaDias: this.media(
          evasoes
            .map((matricula) => matricula.tempoPermanenciaDias)
            .filter((dias): dias is number => typeof dias === 'number'),
        ),
        rankingTurmas: this.rankingPorGrupo(porTurma),
      },
      porStatus: this.agruparPor(data, (matricula) => matricula.status),
      porMotivo,
      data,
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

  async exportarPdf(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    auditUser?: AuditUser,
  ): Promise<Buffer> {
    const filtroExportacao = this.filtroExportacaoPdf(filtro, authUser);
    const relatorio = await this.gerarConsolidado(filtroExportacao, authUser);
    const buffer = await this.pdfExporter.gerar(relatorio, {
      emissorNome: authUser?.nome || authUser?.email || authUser?.sub,
      emissorPerfil: authUser?.role,
    });

    await this.registrarAuditoriaExportacao('PDF', filtroExportacao, authUser, auditUser);
    return buffer;
  }

  async exportarXlsx(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    auditUser?: AuditUser,
  ): Promise<Buffer> {
    const relatorio = await this.gerarConsolidado(filtro, authUser);
    const buffer = await this.xlsxExporter.gerar(relatorio);

    await this.registrarAuditoriaExportacao('XLSX', filtro, authUser, auditUser);
    return buffer;
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

  private filtroExportacaoPdf(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
  ): FiltroRelatorioGeralDto {
    if (authUser?.role !== Role.COMUNICACAO) return filtro;

    return {
      ...(filtro.dataInicio && { dataInicio: filtro.dataInicio }),
      ...(filtro.dataFim && { dataFim: filtro.dataFim }),
      statusAluno: 'TODOS',
    };
  }

  private async registrarAuditoriaExportacao(
    formato: 'PDF' | 'XLSX',
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    auditUser?: AuditUser,
  ): Promise<void> {
    const exportadoEm = new Date().toISOString();
    await this.auditLogService.registrar({
      entidade: 'RelatorioInstitucional',
      registroId: 'institucional',
      acao: AuditAcao.DOWNLOAD,
      autorId: auditUser?.sub || authUser?.sub,
      autorNome: auditUser?.nome || authUser?.nome || authUser?.email,
      autorRole: auditUser?.role || authUser?.role,
      ip: auditUser?.ip,
      userAgent: auditUser?.userAgent,
      newValue: {
        relatorio: 'Relatorio Institucional de Atendimento',
        formato,
        filtros: this.filtrosAuditaveis(filtro),
        perfilExportador: authUser?.role,
        exportadoEm,
        observacaoLgpd:
          formato === 'PDF'
            ? 'PDF institucional gerado somente com dados agregados.'
            : 'XLSX detalhado restrito a perfis administrativos.',
      },
    });
  }

  private filtrosAuditaveis(filtro: FiltroRelatorioGeralDto): Record<string, string> {
    return Object.entries(filtro).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {});
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

  private rankingPorGrupo(grupo: Record<string, number>): Array<{ nome: string; total: number }> {
    return Object.entries(grupo)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }

  private chaveMes(value?: Date | string | null): string {
    if (!value) return 'Nao informado';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Nao informado';
    return date.toISOString().slice(0, 7);
  }

  private diasEntre(inicio?: Date | string | null, fim?: Date | string | null): number | null {
    if (!inicio || !fim) return null;
    const dataInicio = inicio instanceof Date ? inicio : new Date(inicio);
    const dataFim = fim instanceof Date ? fim : new Date(fim);
    if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) return null;
    const diffMs = dataFim.getTime() - dataInicio.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  private media(values: number[]): number {
    if (!values.length) return 0;
    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(2));
  }

  private agruparAcompanhamentosPorAluno(acompanhamentos: AcompanhamentoEvasao[]): Map<string, AcompanhamentoEvasao[]> {
    return acompanhamentos.reduce((acc, acompanhamento) => {
      const atuais = acc.get(acompanhamento.alunoId) ?? [];
      atuais.push(acompanhamento);
      acc.set(acompanhamento.alunoId, atuais);
      return acc;
    }, new Map<string, AcompanhamentoEvasao[]>());
  }

  private resumirAtendimentosIndividuais(
    alunoId: string,
    dataSaida: Date | null,
    acompanhamentosPorAluno: Map<string, AcompanhamentoEvasao[]>,
  ) {
    const acompanhamentos = acompanhamentosPorAluno.get(alunoId) ?? [];
    const limiteSaida = dataSaida?.getTime();
    const atendimentos = acompanhamentos
      .flatMap((acompanhamento) => acompanhamento.atendimentos)
      .filter((atendimento) => !limiteSaida || atendimento.dataAtendimento.getTime() <= limiteSaida);
    const faltasJustificadas = this.contarTipoAtendimento(
      atendimentos,
      TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA,
    );
    const faltasNaoJustificadas = this.contarTipoAtendimento(
      atendimentos,
      TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA,
    );

    return {
      possuiAtendimento: atendimentos.length > 0 || acompanhamentos.length > 0,
      totalAtendimentos: atendimentos.length,
      faltasJustificadas,
      faltasNaoJustificadas,
      cancelados: this.contarTipoAtendimento(atendimentos, TipoRegistroAtendimentoIndividual.CANCELADO),
      acompanhamentosTotal: acompanhamentos.length,
      acompanhamentosEmAndamento: acompanhamentos.filter(
        (acompanhamento) =>
          !acompanhamento.arquivado && acompanhamento.status === StatusAcompanhamentoIndividual.EM_ANDAMENTO,
      ).length,
      acompanhamentosFinalizados: acompanhamentos.filter(
        (acompanhamento) =>
          !acompanhamento.arquivado && acompanhamento.status === StatusAcompanhamentoIndividual.FINALIZADO,
      ).length,
      acompanhamentosArquivados: acompanhamentos.filter((acompanhamento) => acompanhamento.arquivado).length,
      teveFalta: faltasJustificadas + faltasNaoJustificadas > 0,
    };
  }

  private contarTipoAtendimento(
    atendimentos: Array<{ tipoRegistro: TipoRegistroAtendimentoIndividual }>,
    tipo: TipoRegistroAtendimentoIndividual,
  ): number {
    return atendimentos.filter((atendimento) => atendimento.tipoRegistro === tipo).length;
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
