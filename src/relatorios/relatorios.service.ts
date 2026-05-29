import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditAcao,
  CertificateStatus,
  MatriculaStatus,
  MotivoEncerramentoMatricula,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  StatusAcaoRiscoEvasao,
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
import { RelatorioTurmasPdfService, RelatorioTurmasPdfData } from './exporters/relatorio-turmas-pdf.service';

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

type RelatorioOpcao = {
  id: string;
  label: string;
};

type RelatorioRankingItem = {
  label: string;
  total: number;
};

type NivelRiscoEvasao = 'ALTO' | 'MEDIO' | 'BAIXO';

type RelatorioRiscoEvasaoItem = {
  alunoId: string;
  nomeCompleto: string;
  matricula: string | null;
  cidade: string | null;
  bairro: string | null;
  turmaId: string;
  turma: string;
  professor: string | null;
  faltasSeguidas: number;
  taxaPresenca: number;
  ultimaFrequencia: string | null;
  ultimoAtendimento: string | null;
  diasSemRegistro: number | null;
  criterios: string[];
  nivel: NivelRiscoEvasao;
  acaoAberta?: {
    id: string;
    status: string;
    responsavel?: string;
    prazo?: string;
  };
};

type RelatorioRiscoEvasao = {
  filtros: FiltroRelatorioGeralDto;
  total: number;
  indicadores: {
    alto: number;
    medio: number;
    baixo: number;
    tresFaltasSeguidas: number;
    presencaAbaixo60: number;
    semRegistro30Dias: number;
    matriculaAtivaSemFrequenciaRecente: number;
    acoesPendentes: number;
    acoesVencidas: number;
    acoesResolvidasNoMes: number;
  };
  data: RelatorioRiscoEvasaoItem[];
};

type RelatorioImpactoMetricas = {
  totalAlunosAtendidos: number;
  totalAtendimentosIndividuais: number;
  totalTurmasOfertadas: number;
  totalCertificadosEmitidos: number;
  totalAlunosDeficienciaVisualAtendidos: number;
  totalBairrosAlcancados: number;
  totalCidadesAlcancadas: number;
  taxaPermanencia: number;
  taxaConclusao: number;
};

type RelatorioComparativoItem = {
  atual: number;
  anterior: number;
  variacaoPercentual: number;
  direcao: 'SUBIU' | 'DESCEU' | 'ESTAVEL';
};

type RelatorioImpactoSocial = {
  filtros: FiltroRelatorioGeralDto;
  periodo: {
    atual: { dataInicio: string; dataFim: string };
    anterior: { dataInicio: string; dataFim: string };
  };
  metricas: RelatorioImpactoMetricas;
  comparativo: Record<keyof RelatorioImpactoMetricas, RelatorioComparativoItem>;
};

type RelatorioInstitucionalPdf = {
  emitidoEm: string;
  filtros: FiltroRelatorioGeralDto;
  resumo: ResumoRelatorio;
  alunos: {
    porCidadeTop10: RelatorioRankingItem[];
  };
  evasoes: {
    totalEvasoes: number;
    totalCancelamentos: number;
    totalTransferencias: number;
    porMotivoTop10: RelatorioRankingItem[];
    porTurmaTop10: RelatorioRankingItem[];
  };
  atendimentos: {
    total: number;
    porTipoRegistro: Record<string, number>;
  };
  frequencias: {
    total: number;
    presentes: number;
    faltas: number;
    faltasJustificadas: number;
    taxaPresenca: number;
    porStatus: Record<string, number>;
  };
  taxas: {
    taxaEvasao: number;
    taxaConclusao: number;
    taxaPermanencia: number;
    taxaPresenca: number;
  };
  impacto?: RelatorioImpactoMetricas;
};

type CampoRankingAluno = 'tipoDeficiencia' | 'cidade' | 'bairro' | 'escolaridade' | 'rendaFamiliar';

type FiltroRelatorioAlunosListaDto = FiltroRelatorioAlunosDto & {
  page?: string | number;
  limit?: string | number;
};

type RelatorioDetalhadoOptions = {
  limiteDetalhes?: number;
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

const MIN_CARACTERES_BUSCA_OPCOES = 2;
const LIMITE_OPCOES_RELATORIO = 20;
const LIMITE_PADRAO_LISTA_ALUNOS = 20;
const LIMITE_MAXIMO_LISTA_ALUNOS = 50;
const LIMITE_EXPORTACAO_XLSX_DETALHADA = 5000;
const LIMITE_RELACOES_EXPORTACAO_XLSX = 200;
const LIMITE_MATRICULAS_RISCO_EVASAO = 1000;
const LIMITE_ITENS_RISCO_EVASAO = 50;
const DIAS_SEM_REGISTRO_RISCO_EVASAO = 30;
const DIAS_JANELA_RISCO_EVASAO = 120;
const STATUS_ACAO_RISCO_ABERTA = [
  StatusAcaoRiscoEvasao.PENDENTE,
  StatusAcaoRiscoEvasao.EM_ANDAMENTO,
  StatusAcaoRiscoEvasao.SEM_CONTATO,
] as const;

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExporter: RelatorioInstitucionalPdfService,
    private readonly relatorioTurmasPdfService: RelatorioTurmasPdfService,
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

  async riscoEvasao(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<RelatorioRiscoEvasao> {
    this.validarPeriodo(filtro);

    const referencia = this.obterReferenciaRisco(filtro);
    const inicioJanela = this.subtrairDias(referencia, DIAS_JANELA_RISCO_EVASAO);
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: false,
      incluirAluno: true,
      incluirTurma: true,
    });
    matriculaWhere.status = MatriculaStatus.ATIVA;
    matriculaWhere.aluno = this.combinarWhereAluno(matriculaWhere.aluno as Prisma.AlunoWhereInput, {
      excluido: false,
      statusAtivo: true,
    });
    matriculaWhere.turma = this.combinarWhereTurma(matriculaWhere.turma as Prisma.TurmaWhereInput, {
      excluido: false,
      status: { in: [TurmaStatus.PREVISTA, TurmaStatus.ANDAMENTO] },
    });

    const matriculas = await this.prisma.matriculaOficina.findMany({
      where: matriculaWhere,
      select: {
        id: true,
        alunoId: true,
        turmaId: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            matricula: true,
            cidade: true,
            bairro: true,
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            professor: { select: { nome: true } },
          },
        },
      },
      orderBy: { dataEntrada: 'desc' },
      take: LIMITE_MATRICULAS_RISCO_EVASAO,
    });

    if (!matriculas.length) {
      return {
        filtros: filtro,
        total: 0,
        indicadores: this.indicadoresRiscoVazios(),
        data: [],
      };
    }

    const alunoIds = [...new Set(matriculas.map((matricula) => matricula.alunoId))];
    const turmaIds = [...new Set(matriculas.map((matricula) => matricula.turmaId))];
    const inicioMesReferencia = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1, 0, 0, 0, 0));
    const [frequencias, atendimentos, acoesAbertas, acoesResolvidasNoMes] = await Promise.all([
      this.prisma.frequencia.findMany({
        where: {
          alunoId: { in: alunoIds },
          turmaId: { in: turmaIds },
          dataAula: { gte: inicioJanela, lte: referencia },
        },
        select: {
          alunoId: true,
          turmaId: true,
          dataAula: true,
          status: true,
        },
        orderBy: [{ dataAula: 'desc' }],
      }),
      this.prisma.atendimentoIndividual.findMany({
        where: {
          alunoId: { in: alunoIds },
          excluidoEm: null,
          dataAtendimento: { gte: inicioJanela, lte: referencia },
        },
        select: {
          alunoId: true,
          dataAtendimento: true,
        },
        orderBy: [{ dataAtendimento: 'desc' }],
      }),
      this.prisma.acaoRiscoEvasao.findMany({
        where: {
          alunoId: { in: alunoIds },
          turmaId: { in: turmaIds },
          status: { in: [...STATUS_ACAO_RISCO_ABERTA] },
        },
        select: {
          id: true,
          alunoId: true,
          turmaId: true,
          status: true,
          prazo: true,
          responsavel: { select: { nome: true } },
        },
        orderBy: [{ criadoEm: 'desc' }],
      }),
      this.prisma.acaoRiscoEvasao.count({
        where: {
          alunoId: { in: alunoIds },
          turmaId: { in: turmaIds },
          status: StatusAcaoRiscoEvasao.RESOLVIDA,
          resolvidoEm: { gte: inicioMesReferencia, lte: referencia },
        },
      }),
    ]);

    const frequenciasPorMatricula = new Map<string, typeof frequencias>();
    frequencias.forEach((frequencia) => {
      const chave = this.chaveAlunoTurma(frequencia.alunoId, frequencia.turmaId);
      const lista = frequenciasPorMatricula.get(chave) ?? [];
      lista.push(frequencia);
      frequenciasPorMatricula.set(chave, lista);
    });

    const ultimoAtendimentoPorAluno = new Map<string, Date>();
    atendimentos.forEach((atendimento) => {
      if (!ultimoAtendimentoPorAluno.has(atendimento.alunoId)) {
        ultimoAtendimentoPorAluno.set(atendimento.alunoId, atendimento.dataAtendimento);
      }
    });

    const acaoAbertaPorMatricula = new Map<string, (typeof acoesAbertas)[number]>();
    acoesAbertas.forEach((acao) => {
      if (!acao.turmaId) return;
      const chave = this.chaveAlunoTurma(acao.alunoId, acao.turmaId);
      if (!acaoAbertaPorMatricula.has(chave)) {
        acaoAbertaPorMatricula.set(chave, acao);
      }
    });

    const itens = matriculas
      .map((matricula): RelatorioRiscoEvasaoItem | null => {
        const freqs = frequenciasPorMatricula.get(this.chaveAlunoTurma(matricula.alunoId, matricula.turmaId)) ?? [];
        const totalFrequencias = freqs.length;
        const presentes = freqs.filter((freq) => freq.status === StatusFrequencia.PRESENTE).length;
        const taxaPresenca = totalFrequencias ? this.percentual(presentes, totalFrequencias) : 0;
        const faltasSeguidas = this.contarFaltasSeguidas(freqs);
        const ultimaFrequencia = freqs[0]?.dataAula ?? null;
        const ultimoAtendimento = ultimoAtendimentoPorAluno.get(matricula.alunoId) ?? null;
        const acaoAberta = acaoAbertaPorMatricula.get(this.chaveAlunoTurma(matricula.alunoId, matricula.turmaId));
        const ultimaAtividade = this.dataMaisRecente([ultimaFrequencia, ultimoAtendimento]);
        const diasSemRegistro = ultimaAtividade ? this.diasEntreDatas(ultimaAtividade, referencia) : null;
        const diasSemFrequencia = ultimaFrequencia ? this.diasEntreDatas(ultimaFrequencia, referencia) : null;
        const criterios: string[] = [];

        if (faltasSeguidas >= 3) criterios.push('3 faltas seguidas');
        if (totalFrequencias >= 3 && taxaPresenca < 60) criterios.push('Presença abaixo de 60%');
        if (diasSemRegistro === null || diasSemRegistro > DIAS_SEM_REGISTRO_RISCO_EVASAO) {
          criterios.push('Sem atendimento/frequência há mais de 30 dias');
        }
        if (diasSemFrequencia === null || diasSemFrequencia > DIAS_SEM_REGISTRO_RISCO_EVASAO) {
          criterios.push('Matrícula ativa sem frequência recente');
        }

        if (!criterios.length) return null;

        return {
          alunoId: matricula.aluno.id,
          nomeCompleto: matricula.aluno.nomeCompleto,
          matricula: matricula.aluno.matricula,
          cidade: matricula.aluno.cidade,
          bairro: matricula.aluno.bairro,
          turmaId: matricula.turma.id,
          turma: matricula.turma.nome,
          professor: matricula.turma.professor?.nome ?? null,
          faltasSeguidas,
          taxaPresenca,
          ultimaFrequencia: ultimaFrequencia?.toISOString() ?? null,
          ultimoAtendimento: ultimoAtendimento?.toISOString() ?? null,
          diasSemRegistro,
          criterios,
          nivel: this.nivelRisco(criterios.length, faltasSeguidas),
          ...(acaoAberta && {
            acaoAberta: {
              id: acaoAberta.id,
              status: acaoAberta.status,
              responsavel: acaoAberta.responsavel?.nome,
              prazo: acaoAberta.prazo?.toISOString(),
            },
          }),
        };
      })
      .filter((item): item is RelatorioRiscoEvasaoItem => Boolean(item));

    const ordenados = itens.sort((a, b) => {
      const pesoNivel: Record<NivelRiscoEvasao, number> = { ALTO: 3, MEDIO: 2, BAIXO: 1 };
      return (
        pesoNivel[b.nivel] - pesoNivel[a.nivel] ||
        b.criterios.length - a.criterios.length ||
        b.faltasSeguidas - a.faltasSeguidas ||
        a.nomeCompleto.localeCompare(b.nomeCompleto)
      );
    });

    return {
      filtros: filtro,
      total: ordenados.length,
      indicadores: {
        alto: ordenados.filter((item) => item.nivel === 'ALTO').length,
        medio: ordenados.filter((item) => item.nivel === 'MEDIO').length,
        baixo: ordenados.filter((item) => item.nivel === 'BAIXO').length,
        tresFaltasSeguidas: ordenados.filter((item) => item.criterios.includes('3 faltas seguidas')).length,
        presencaAbaixo60: ordenados.filter((item) => item.criterios.includes('Presença abaixo de 60%')).length,
        semRegistro30Dias: ordenados.filter((item) =>
          item.criterios.includes('Sem atendimento/frequência há mais de 30 dias'),
        ).length,
        matriculaAtivaSemFrequenciaRecente: ordenados.filter((item) =>
          item.criterios.includes('Matrícula ativa sem frequência recente'),
        ).length,
        acoesPendentes: acoesAbertas.filter((acao) => acao.status === StatusAcaoRiscoEvasao.PENDENTE).length,
        acoesVencidas: acoesAbertas.filter(
          (acao) =>
            acao.prazo &&
            acao.prazo < this.inicioDoDia(new Date()) &&
            acao.status !== StatusAcaoRiscoEvasao.RESOLVIDA,
        ).length,
        acoesResolvidasNoMes,
      },
      data: ordenados.slice(0, LIMITE_ITENS_RISCO_EVASAO),
    };
  }

  async impactoSocial(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser): Promise<RelatorioImpactoSocial> {
    this.validarPeriodo(filtro);

    const periodo = this.periodoAtualEAnterior(filtro);
    const filtroAtual = this.filtroComPeriodo(filtro, periodo.atual.inicio, periodo.atual.fim);
    const filtroAnterior = this.filtroComPeriodo(filtro, periodo.anterior.inicio, periodo.anterior.fim);

    const [metricas, metricasAnteriores] = await Promise.all([
      this.calcularImpactoMetricas(filtroAtual, authUser),
      this.calcularImpactoMetricas(filtroAnterior, authUser),
    ]);

    return {
      filtros: filtro,
      periodo: {
        atual: {
          dataInicio: this.formatarDataIso(periodo.atual.inicio),
          dataFim: this.formatarDataIso(periodo.atual.fim),
        },
        anterior: {
          dataInicio: this.formatarDataIso(periodo.anterior.inicio),
          dataFim: this.formatarDataIso(periodo.anterior.fim),
        },
      },
      metricas,
      comparativo: this.compararMetricas(metricas, metricasAnteriores),
    };
  }

  async opcoesTurmas(busca?: string): Promise<RelatorioOpcao[]> {
    const termo = this.normalizarBuscaOpcao(busca);
    if (!termo) return [];

    const turmas = await this.prisma.turma.findMany({
      where: {
        excluido: false,
        nome: { contains: termo, mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        nome: true,
      },
      orderBy: { nome: 'asc' },
      take: LIMITE_OPCOES_RELATORIO,
    });

    return turmas.map((turma) => ({
      id: turma.id,
      label: turma.nome,
    }));
  }

  async opcoesProfessores(busca?: string): Promise<RelatorioOpcao[]> {
    const termo = this.normalizarBuscaOpcao(busca);
    if (!termo) return [];

    const professores = await this.prisma.user.findMany({
      where: {
        role: Role.PROFESSOR,
        statusAtivo: true,
        excluido: false,
        OR: [
          { nome: { contains: termo, mode: Prisma.QueryMode.insensitive } },
          { matricula: { contains: termo, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: termo, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: {
        id: true,
        nome: true,
        matricula: true,
      },
      orderBy: { nome: 'asc' },
      take: LIMITE_OPCOES_RELATORIO,
    });

    return professores.map((professor) => ({
      id: professor.id,
      label: professor.matricula ? `${professor.nome} (${professor.matricula})` : professor.nome,
    }));
  }

  async opcoesAlunos(busca?: string): Promise<RelatorioOpcao[]> {
    const termo = this.normalizarBuscaOpcao(busca);
    if (!termo) return [];
    const termoCpf = termo.replaceAll(/\D/g, '');
    const or: Prisma.AlunoWhereInput[] = [
      { nomeCompleto: { contains: termo, mode: Prisma.QueryMode.insensitive } },
      { matricula: { contains: termo, mode: Prisma.QueryMode.insensitive } },
    ];

    if (termoCpf.length >= MIN_CARACTERES_BUSCA_OPCOES) {
      or.push({ cpf: { contains: termoCpf, mode: Prisma.QueryMode.insensitive } });
    }

    const alunos = await this.prisma.aluno.findMany({
      where: {
        excluido: false,
        OR: or,
      },
      select: {
        id: true,
        nomeCompleto: true,
        matricula: true,
      },
      orderBy: { nomeCompleto: 'asc' },
      take: LIMITE_OPCOES_RELATORIO,
    });

    return alunos.map((aluno) => ({
      id: aluno.id,
      label: aluno.matricula ? `${aluno.nomeCompleto} (${aluno.matricula})` : aluno.nomeCompleto,
    }));
  }

  async opcoesCidades(busca?: string): Promise<RelatorioOpcao[]> {
    const termo = this.normalizarBuscaOpcao(busca);
    if (!termo) return [];

    const cidades = await this.prisma.aluno.findMany({
      where: {
        excluido: false,
        cidade: {
          startsWith: termo,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      distinct: ['cidade'],
      select: {
        cidade: true,
      },
      orderBy: { cidade: 'asc' },
      take: LIMITE_OPCOES_RELATORIO,
    });

    return cidades.flatMap((aluno) => {
      const cidade = aluno.cidade?.trim();
      return cidade ? [{ id: cidade, label: cidade }] : [];
    });
  }

  async opcoesBairros(busca?: string, cidade?: string): Promise<RelatorioOpcao[]> {
    const termo = this.normalizarBuscaOpcao(busca);
    if (!termo) return [];
    const cidadeFiltro = cidade?.trim();

    const bairros = await this.prisma.aluno.findMany({
      where: {
        excluido: false,
        ...(cidadeFiltro
          ? {
              cidade: {
                equals: cidadeFiltro,
                mode: Prisma.QueryMode.insensitive,
              },
            }
          : {}),
        bairro: {
          startsWith: termo,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      distinct: ['bairro'],
      select: {
        bairro: true,
      },
      orderBy: { bairro: 'asc' },
      take: LIMITE_OPCOES_RELATORIO,
    });

    return bairros.flatMap((aluno) => {
      const bairro = aluno.bairro?.trim();
      return bairro ? [{ id: bairro, label: bairro }] : [];
    });
  }

  async alunos(
    filtro: FiltroRelatorioAlunosDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: false,
      incluirAluno: false,
    });
    const limiteDetalhes = this.normalizarLimiteDetalhes(options.limiteDetalhes);
    const limiteRelacoes = limiteDetalhes ? Math.min(limiteDetalhes, LIMITE_RELACOES_EXPORTACAO_XLSX) : undefined;

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
          ...(limiteRelacoes && { take: limiteRelacoes }),
        },
      },
      orderBy: { nomeCompleto: 'asc' },
      ...(limiteDetalhes && { take: limiteDetalhes }),
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

  async alunosResumo(filtro: FiltroRelatorioAlunosDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const whereComLaudo = this.combinarWhereAluno(where, {
      OR: [{ possuiLaudo: true }, { laudoUrl: { not: null } }],
    });

    const [totalCadastrados, ativos, inativos, comLaudo, precisamAcompanhante, lgpdAceito] =
      await this.prisma.$transaction([
        this.prisma.aluno.count({ where }),
        this.prisma.aluno.count({ where: this.combinarWhereAluno(where, { statusAtivo: true }) }),
        this.prisma.aluno.count({ where: this.combinarWhereAluno(where, { statusAtivo: false }) }),
        this.prisma.aluno.count({ where: whereComLaudo }),
        this.prisma.aluno.count({ where: this.combinarWhereAluno(where, { precisaAcompanhante: true }) }),
        this.prisma.aluno.count({ where: this.combinarWhereAluno(where, { termoLgpdAceito: true }) }),
      ]);

    return {
      totalCadastrados,
      ativos,
      inativos,
      comLaudo,
      semLaudo: Math.max(0, totalCadastrados - comLaudo),
      precisamAcompanhante,
      lgpdAceito,
    };
  }

  async alunosDistribuicoes(filtro: FiltroRelatorioAlunosDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const [porTipoDeficiencia, porCidadeTop10, porBairroTop10, porEscolaridadeTop10, porRendaFamiliarTop10] =
      await Promise.all([
        this.rankingAlunosPorCampo(where, 'tipoDeficiencia'),
        this.rankingAlunosPorCampo(where, 'cidade'),
        this.rankingAlunosPorCampo(where, 'bairro'),
        this.rankingAlunosPorCampo(where, 'escolaridade'),
        this.rankingAlunosPorCampo(where, 'rendaFamiliar'),
      ]);

    return {
      porTipoDeficiencia,
      porCidadeTop10,
      porBairroTop10,
      porEscolaridadeTop10,
      porRendaFamiliarTop10,
    };
  }

  async alunosLista(filtro: FiltroRelatorioAlunosListaDto, authUser?: AuthenticatedUser) {
    this.validarPeriodo(filtro);
    const page = this.normalizarInteiroPositivo(filtro.page, 1);
    const limit = this.normalizarInteiroPositivo(
      filtro.limit,
      LIMITE_PADRAO_LISTA_ALUNOS,
      LIMITE_MAXIMO_LISTA_ALUNOS,
    );
    const where = this.montarWhereAluno(filtro, authUser, { aplicarPeriodo: true });
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.aluno.count({ where }),
      this.prisma.aluno.findMany({
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
        },
        orderBy: { nomeCompleto: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async turmas(
    filtro: FiltroRelatorioTurmasDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: true });
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: false,
      incluirTurma: false,
    });
    const limiteDetalhes = this.normalizarLimiteDetalhes(options.limiteDetalhes);
    const limiteRelacoes = limiteDetalhes ? Math.min(limiteDetalhes, LIMITE_RELACOES_EXPORTACAO_XLSX) : undefined;

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
          ...(limiteRelacoes && { take: limiteRelacoes }),
        },
        _count: {
          select: {
            frequencias: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
      ...(limiteDetalhes && { take: limiteDetalhes }),
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

  async turmasPdf(filtro: FiltroRelatorioTurmasDto, authUser: AuthenticatedUser): Promise<Buffer> {
    const relatorio = await this.turmas(filtro, authUser, { limiteDetalhes: 1000 });
    const turmaIds = relatorio.data.map((t) => t.id);

    const frequencias = await this.prisma.frequencia.findMany({
      where: {
        turmaId: { in: turmaIds },
      },
      select: {
        turmaId: true,
        alunoId: true,
        status: true,
      },
    });

    const frequenciasPorTurmaEAluno = new Map<string, typeof frequencias>();
    frequencias.forEach((f) => {
      const key = `${f.turmaId}-${f.alunoId}`;
      const list = frequenciasPorTurmaEAluno.get(key) || [];
      list.push(f);
      frequenciasPorTurmaEAluno.set(key, list);
    });

    let totalPresencas = 0;
    let totalFaltas = 0;

    const turmasFormatadas = relatorio.data.map((turma) => {
      const alunos = turma.matriculasOficina.map((matricula) => {
        const freqs = frequenciasPorTurmaEAluno.get(`${turma.id}-${matricula.aluno.id}`) || [];
        const presencas = freqs.filter(f => f.status === StatusFrequencia.PRESENTE).length;
        const faltas = freqs.filter(f => f.status === StatusFrequencia.FALTA).length;
        const faltasJustificadas = freqs.filter(f => f.status === StatusFrequencia.FALTA_JUSTIFICADA).length;
        const total = freqs.length;
        const frequenciaPercentual = total ? Math.round((presencas / total) * 100) : 0;

        totalPresencas += presencas;
        totalFaltas += (faltas + faltasJustificadas);

        return {
          nome: matricula.aluno.nomeCompleto,
          matricula: matricula.aluno.matricula || '-',
          statusMatricula: this.formatarEnumRelatorio(matricula.status),
          presencas,
          faltas,
          faltasJustificadas,
          frequenciaPercentual,
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome));

      return {
        nome: turma.nome,
        professor: turma.professor?.nome || 'Não atribuído',
        status: this.formatarEnumRelatorio(turma.status),
        periodo: this.formatarPeriodoTurma(turma.dataInicio, turma.dataFim),
        horario: '-', 
        diasDaSemana: '-',
        cargaHoraria: turma.cargaHoraria || 'Não informada',
        totalAlunos: alunos.length,
        alunos,
      };
    });

    const data: RelatorioTurmasPdfData = {
      emitidoEm: new Date(),
      filtrosDescricao: this.descreverFiltrosTurmas(filtro),
      emissorNome: authUser?.nome || 'Usuário',
      resumo: {
        totalTurmas: relatorio.indicadores.totalTurmas,
        ativas: relatorio.indicadores.andamento,
        concluidas: relatorio.indicadores.concluidas,
        arquivadas: relatorio.indicadores.arquivadas,
        totalAlunosMatriculados: relatorio.data.reduce((acc, t) => acc + t.metricas.totalMatriculas, 0),
        totalPresencas,
        totalFaltas,
      },
      turmas: turmasFormatadas,
    };

    await this.auditLogService.registrar({
      entidade: 'Relatorio',
      acao: AuditAcao.DOWNLOAD,
      autorId: authUser.sub,
      autorNome: authUser.nome,
      autorRole: authUser.role,
      newValue: { tipo: 'TURMAS_PDF', filtros: filtro },
    });

    return this.relatorioTurmasPdfService.gerar(data);
  }

  private descreverFiltrosTurmas(filtros: any): string {
    const chaves = ['dataInicio', 'dataFim', 'statusTurma', 'professorId'];
    const entries = Object.entries(filtros).filter(
      ([key, value]) => chaves.includes(key) && value !== undefined && value !== null && value !== '',
    );
    if (!entries.length) return 'Filtros: todos os registros permitidos';
    return `Filtros: ${entries.map(([key, value]) => `${key}=${value}`).join('; ')}`;
  }

  private formatarEnumRelatorio(value?: string | null): string {
    if (!value) return 'Não informado';
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatarPeriodoTurma(inicio?: Date | null, fim?: Date | null): string {
    const fInicio = inicio ? new Date(inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';
    const fFim = fim ? new Date(fim).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';
    return `${fInicio} a ${fFim}`;
  }

  async evasoes(
    filtro: FiltroRelatorioEvasoesDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ) {
    this.validarPeriodo(filtro);
    const statusPadrao = filtro.statusMatricula ? undefined : [...STATUS_RELATORIO_EVASOES];
    const where = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: true,
      statusPadrao,
      periodoCampos: ['dataEncerramento', 'encerradoEm'],
    });
    const limiteDetalhes = this.normalizarLimiteDetalhes(options.limiteDetalhes);

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
      ...(limiteDetalhes && { take: limiteDetalhes }),
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

  async atendimentos(
    filtro: FiltroRelatorioAtendimentosDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereAtendimento(filtro, authUser);
    const limiteDetalhes = this.normalizarLimiteDetalhes(options.limiteDetalhes);

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
      ...(limiteDetalhes && { take: limiteDetalhes }),
    });

    return {
      filtros: filtro,
      total: atendimentos.length,
      porTipoRegistro: this.agruparPor(atendimentos, (atendimento) => atendimento.tipoRegistro),
      data: atendimentos,
    };
  }

  async frequencias(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ) {
    this.validarPeriodo(filtro);
    const where = this.montarWhereFrequencia(filtro, authUser);
    const limiteDetalhes = this.normalizarLimiteDetalhes(options.limiteDetalhes);

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
      ...(limiteDetalhes && { take: limiteDetalhes }),
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

  async gerarConsolidado(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    options: RelatorioDetalhadoOptions = {},
  ): Promise<RelatorioExportacao> {
    const [resumo, alunos, turmas, evasoes, atendimentos, frequencias] = await Promise.all([
      this.resumo(filtro, authUser),
      this.alunos(filtro, authUser, options),
      this.turmas(filtro, authUser, options),
      this.evasoes(filtro, authUser, options),
      this.atendimentos(filtro, authUser, options),
      this.frequencias(filtro, authUser, options),
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

  async gerarConsolidadoInstitucional(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
  ): Promise<RelatorioInstitucionalPdf> {
    const [resumo, distribuicoesAlunos, evasoes, atendimentos, frequencias, impactoSocial] = await Promise.all([
      this.resumo(filtro, authUser),
      this.alunosDistribuicoes(filtro, authUser),
      this.evasoesInstitucionais(filtro, authUser),
      this.atendimentosInstitucionais(filtro, authUser),
      this.frequenciasInstitucionais(filtro, authUser),
      this.impactoSocial(filtro, authUser),
    ]);

    return {
      emitidoEm: new Date().toISOString(),
      filtros: filtro,
      resumo,
      alunos: {
        porCidadeTop10: distribuicoesAlunos.porCidadeTop10,
      },
      evasoes,
      atendimentos,
      frequencias,
      taxas: {
        taxaEvasao: resumo.indicadores.taxaEvasao,
        taxaConclusao: resumo.indicadores.taxaConclusao,
        taxaPermanencia: resumo.indicadores.taxaPermanencia,
        taxaPresenca: frequencias.taxaPresenca,
      },
      impacto: impactoSocial.metricas,
    };
  }

  async exportarPdf(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
    auditUser?: AuditUser,
  ): Promise<Buffer> {
    const filtroExportacao = this.filtroExportacaoPdf(filtro, authUser);
    const relatorio = await this.gerarConsolidadoInstitucional(filtroExportacao, authUser);
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
    const relatorio = await this.gerarConsolidado(filtro, authUser, {
      limiteDetalhes: LIMITE_EXPORTACAO_XLSX_DETALHADA,
    });
    const buffer = await this.xlsxExporter.gerar(relatorio);

    await this.registrarAuditoriaExportacao('XLSX', filtro, authUser, auditUser);
    return buffer;
  }

  private async evasoesInstitucionais(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser) {
    const encerramentosWhere = this.montarWhereMatricula(filtro, authUser, {
      aplicarPeriodo: true,
      statusPadrao: [...STATUS_RELATORIO_EVASOES],
    });
    const evasoesWhere = this.combinarWhereMatricula(encerramentosWhere, { status: MatriculaStatus.EVADIDA });

    const [statusRows, motivoRows, turmaRows] = await Promise.all([
      this.prisma.matriculaOficina.groupBy({
        by: ['status'],
        where: encerramentosWhere,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.matriculaOficina.groupBy({
        by: ['motivoEncerramento'],
        where: this.combinarWhereMatricula(evasoesWhere, {
          motivoEncerramento: { not: null },
        }),
        orderBy: { _count: { motivoEncerramento: 'desc' } },
        _count: { _all: true },
        take: 10,
      }),
      this.prisma.matriculaOficina.groupBy({
        by: ['turmaId'],
        where: evasoesWhere,
        orderBy: { _count: { turmaId: 'desc' } },
        _count: { _all: true },
        take: 10,
      }),
    ]);

    const status = this.contagensPorChave<MatriculaStatus>(statusRows, 'status');
    const turmaIds = turmaRows.map((row) => row.turmaId).filter((id): id is string => Boolean(id));
    const turmas = turmaIds.length
      ? await this.prisma.turma.findMany({
          where: { id: { in: turmaIds } },
          select: { id: true, nome: true },
        })
      : [];
    const turmaPorId = new Map(turmas.map((turma) => [turma.id, turma.nome]));

    return {
      totalEvasoes: status[MatriculaStatus.EVADIDA] ?? 0,
      totalCancelamentos: status[MatriculaStatus.CANCELADA] ?? 0,
      totalTransferencias: status[MatriculaStatus.TRANSFERIDA] ?? 0,
      porMotivoTop10: motivoRows.map((row) => ({
        label: this.valorRankingAluno(row.motivoEncerramento),
        total: row._count._all,
      })),
      porTurmaTop10: turmaRows.map((row) => ({
        label: turmaPorId.get(row.turmaId) ?? 'Turma nao encontrada',
        total: row._count._all,
      })),
    };
  }

  private async atendimentosInstitucionais(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser) {
    const where = this.montarWhereAtendimento(filtro, authUser);
    const rows = await this.prisma.atendimentoIndividual.groupBy({
      by: ['tipoRegistro'],
      where,
      orderBy: { tipoRegistro: 'asc' },
      _count: { _all: true },
    });
    const porTipoRegistro = this.contagensPorChave<string>(rows, 'tipoRegistro');

    return {
      total: this.somarContagens(porTipoRegistro),
      porTipoRegistro,
    };
  }

  private async frequenciasInstitucionais(filtro: FiltroRelatorioGeralDto, authUser?: AuthenticatedUser) {
    const where = this.montarWhereFrequencia(filtro, authUser);
    const rows = await this.prisma.frequencia.groupBy({
      by: ['status'],
      where,
      orderBy: { status: 'asc' },
      _count: { _all: true },
    });
    const porStatus = this.contagensPorChave<StatusFrequencia>(rows, 'status');
    const total = this.somarContagens(porStatus);
    const presentes = porStatus[StatusFrequencia.PRESENTE] ?? 0;
    const faltas = porStatus[StatusFrequencia.FALTA] ?? 0;
    const faltasJustificadas = porStatus[StatusFrequencia.FALTA_JUSTIFICADA] ?? 0;

    return {
      total,
      presentes,
      faltas,
      faltasJustificadas,
      taxaPresenca: this.percentual(presentes, total),
      porStatus,
    };
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

  private normalizarBuscaOpcao(busca?: string): string | null {
    const termo = busca?.trim();
    return termo && termo.length >= MIN_CARACTERES_BUSCA_OPCOES ? termo : null;
  }

  private indicadoresRiscoVazios(): RelatorioRiscoEvasao['indicadores'] {
    return {
      alto: 0,
      medio: 0,
      baixo: 0,
      tresFaltasSeguidas: 0,
      presencaAbaixo60: 0,
      semRegistro30Dias: 0,
      matriculaAtivaSemFrequenciaRecente: 0,
      acoesPendentes: 0,
      acoesVencidas: 0,
      acoesResolvidasNoMes: 0,
    };
  }

  private obterReferenciaRisco(filtro: FiltroRelatorioGeralDto): Date {
    const periodo = this.obterPeriodo(filtro);
    return periodo.fim ?? this.fimDoDia(new Date());
  }

  private chaveAlunoTurma(alunoId: string, turmaId: string): string {
    return `${alunoId}:${turmaId}`;
  }

  private contarFaltasSeguidas(frequencias: Array<{ status: StatusFrequencia }>): number {
    let total = 0;
    for (const frequencia of frequencias) {
      if (frequencia.status !== StatusFrequencia.FALTA) break;
      total += 1;
    }
    return total;
  }

  private dataMaisRecente(datas: Array<Date | null | undefined>): Date | null {
    return datas.reduce<Date | null>((maisRecente, data) => {
      if (!data) return maisRecente;
      if (!maisRecente || data.getTime() > maisRecente.getTime()) return data;
      return maisRecente;
    }, null);
  }

  private diasEntreDatas(inicio: Date, fim: Date): number {
    const msDia = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / msDia));
  }

  private diasCalendarioInclusivo(inicio: Date, fim: Date): number {
    const msDia = 24 * 60 * 60 * 1000;
    const inicioUtc = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
    const fimUtc = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());
    return Math.max(1, Math.floor((fimUtc - inicioUtc) / msDia) + 1);
  }

  private nivelRisco(totalCriterios: number, faltasSeguidas: number): NivelRiscoEvasao {
    if (faltasSeguidas >= 3 || totalCriterios >= 3) return 'ALTO';
    if (totalCriterios >= 2) return 'MEDIO';
    return 'BAIXO';
  }

  private async calcularImpactoMetricas(
    filtro: FiltroRelatorioGeralDto,
    authUser?: AuthenticatedUser,
  ): Promise<RelatorioImpactoMetricas> {
    const matriculaWhere = this.montarWhereMatricula(filtro, authUser, { aplicarPeriodo: true });
    const atendimentoWhere = this.montarWhereAtendimento(filtro, authUser);
    const frequenciaWhere = this.montarWhereFrequencia(filtro, authUser);
    const turmaWhere = this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: true });
    const certificadoWhere = this.montarWhereCertificado(filtro, authUser);

    const [
      alunosComMatricula,
      alunosComAtendimento,
      alunosComFrequencia,
      totalAtendimentosIndividuais,
      totalTurmasOfertadas,
      totalCertificadosEmitidos,
      resumo,
    ] = await Promise.all([
      this.prisma.matriculaOficina.findMany({
        where: matriculaWhere,
        distinct: ['alunoId'],
        select: { alunoId: true },
      }),
      this.prisma.atendimentoIndividual.findMany({
        where: atendimentoWhere,
        distinct: ['alunoId'],
        select: { alunoId: true },
      }),
      this.prisma.frequencia.findMany({
        where: frequenciaWhere,
        distinct: ['alunoId'],
        select: { alunoId: true },
      }),
      this.prisma.atendimentoIndividual.count({ where: atendimentoWhere }),
      this.prisma.turma.count({ where: turmaWhere }),
      this.prisma.certificadoEmitido.count({ where: certificadoWhere }),
      this.resumo(filtro, authUser),
    ]);

    const alunoIds = [
      ...new Set([
        ...alunosComMatricula.map((aluno) => aluno.alunoId),
        ...alunosComAtendimento.map((aluno) => aluno.alunoId),
        ...alunosComFrequencia.map((aluno) => aluno.alunoId),
      ]),
    ];

    let totalAlunosDeficienciaVisualAtendidos = 0;
    let totalCidadesAlcancadas = 0;
    let totalBairrosAlcancados = 0;

    if (alunoIds.length) {
      const alunoWhere = this.combinarWhereAluno(this.montarWhereAlunoBasico(filtro, {
        aplicarPeriodo: false,
        ignorarAlunoId: true,
      }), {
        id: { in: alunoIds },
      });

      const [alunosDeficienciaVisual, cidades, bairros] = await Promise.all([
        this.prisma.aluno.count({
          where: this.combinarWhereAluno(alunoWhere, { tipoDeficiencia: { not: null } }),
        }),
        this.prisma.aluno.findMany({
          where: this.combinarWhereAluno(alunoWhere, {
            cidade: { not: null },
          }),
          distinct: ['cidade'],
          select: { cidade: true },
        }),
        this.prisma.aluno.findMany({
          where: this.combinarWhereAluno(alunoWhere, {
            bairro: { not: null },
          }),
          distinct: ['bairro'],
          select: { bairro: true },
        }),
      ]);

      totalAlunosDeficienciaVisualAtendidos = alunosDeficienciaVisual;
      totalCidadesAlcancadas = cidades.filter((aluno) => this.temTexto(aluno.cidade)).length;
      totalBairrosAlcancados = bairros.filter((aluno) => this.temTexto(aluno.bairro)).length;
    }

    return {
      totalAlunosAtendidos: alunoIds.length,
      totalAtendimentosIndividuais,
      totalTurmasOfertadas,
      totalCertificadosEmitidos,
      totalAlunosDeficienciaVisualAtendidos,
      totalBairrosAlcancados,
      totalCidadesAlcancadas,
      taxaPermanencia: resumo.indicadores.taxaPermanencia,
      taxaConclusao: resumo.indicadores.taxaConclusao,
    };
  }

  private montarWhereCertificado(
    filtro: FiltroRelatorioGeralDto,
    authUser: AuthenticatedUser | undefined,
  ): Prisma.CertificadoEmitidoWhereInput {
    const periodo = this.obterPeriodo(filtro);
    const range = this.montarRange(periodo);
    const where: Prisma.CertificadoEmitidoWhereInput = {
      status: { in: [CertificateStatus.VALID, CertificateStatus.REISSUED] },
      aluno: this.montarWhereAlunoBasico(filtro, { aplicarPeriodo: false, ignorarAlunoId: true }),
      turma: this.montarWhereTurma(filtro, authUser, { aplicarPeriodo: false }),
    };

    if (range) where.dataEmissao = range;
    if (filtro.alunoId) where.alunoId = filtro.alunoId;
    if (filtro.turmaId) where.turmaId = filtro.turmaId;

    return where;
  }

  private periodoAtualEAnterior(filtro: FiltroRelatorioGeralDto): {
    atual: PeriodoRelatorio & { inicio: Date; fim: Date };
    anterior: PeriodoRelatorio & { inicio: Date; fim: Date };
  } {
    const periodo = this.obterPeriodo(filtro);
    const fimAtual = this.fimDoDia(periodo.fim ?? new Date());
    const inicioAtual = this.inicioDoDia(
      periodo.inicio ?? new Date(Date.UTC(fimAtual.getUTCFullYear(), fimAtual.getUTCMonth(), 1)),
    );
    const diasPeriodo = this.diasCalendarioInclusivo(inicioAtual, fimAtual);
    const fimAnterior = this.fimDoDia(this.subtrairDias(inicioAtual, 1));
    const inicioAnterior = this.inicioDoDia(this.subtrairDias(fimAnterior, diasPeriodo - 1));

    return {
      atual: { inicio: inicioAtual, fim: fimAtual },
      anterior: { inicio: inicioAnterior, fim: fimAnterior },
    };
  }

  private filtroComPeriodo(filtro: FiltroRelatorioGeralDto, inicio: Date, fim: Date): FiltroRelatorioGeralDto {
    return {
      ...filtro,
      dataInicio: this.formatarDataIso(inicio),
      dataFim: this.formatarDataIso(fim),
    };
  }

  private compararMetricas(
    atual: RelatorioImpactoMetricas,
    anterior: RelatorioImpactoMetricas,
  ): Record<keyof RelatorioImpactoMetricas, RelatorioComparativoItem> {
    return (Object.keys(atual) as Array<keyof RelatorioImpactoMetricas>).reduce(
      (acc, chave) => ({
        ...acc,
        [chave]: this.compararMetrica(atual[chave], anterior[chave]),
      }),
      {} as Record<keyof RelatorioImpactoMetricas, RelatorioComparativoItem>,
    );
  }

  private compararMetrica(atual: number, anterior: number): RelatorioComparativoItem {
    const variacaoPercentual = anterior ? this.percentual(atual - anterior, anterior) : atual > 0 ? 100 : 0;
    return {
      atual,
      anterior,
      variacaoPercentual,
      direcao: variacaoPercentual > 0 ? 'SUBIU' : variacaoPercentual < 0 ? 'DESCEU' : 'ESTAVEL',
    };
  }

  private inicioDoDia(date: Date): Date {
    const clone = new Date(date);
    clone.setUTCHours(0, 0, 0, 0);
    return clone;
  }

  private fimDoDia(date: Date): Date {
    const clone = new Date(date);
    clone.setUTCHours(23, 59, 59, 999);
    return clone;
  }

  private subtrairDias(date: Date, dias: number): Date {
    const clone = new Date(date);
    clone.setUTCDate(clone.getUTCDate() - dias);
    return clone;
  }

  private formatarDataIso(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private combinarWhereAluno(base: Prisma.AlunoWhereInput, extra: Prisma.AlunoWhereInput): Prisma.AlunoWhereInput {
    return { AND: [base, extra] };
  }

  private combinarWhereTurma(base: Prisma.TurmaWhereInput, extra: Prisma.TurmaWhereInput): Prisma.TurmaWhereInput {
    return { AND: [base, extra] };
  }

  private combinarWhereMatricula(
    base: Prisma.MatriculaOficinaWhereInput,
    extra: Prisma.MatriculaOficinaWhereInput,
  ): Prisma.MatriculaOficinaWhereInput {
    return { AND: [base, extra] };
  }

  private async rankingAlunosPorCampo(
    where: Prisma.AlunoWhereInput,
    campo: CampoRankingAluno,
  ): Promise<RelatorioRankingItem[]> {
    const filtroCampo: Prisma.AlunoWhereInput[] = [{ [campo]: { not: null } } as Prisma.AlunoWhereInput];

    if (campo !== 'tipoDeficiencia') {
      filtroCampo.push({ [campo]: { not: '' } } as Prisma.AlunoWhereInput);
    }

    const args = {
      by: [campo],
      where: this.combinarWhereAluno(where, { AND: filtroCampo }),
      orderBy: { _count: { [campo]: 'desc' } },
      _count: { _all: true },
      take: 10,
    };
    const groupBy = this.prisma.aluno.groupBy as unknown as (
      this: typeof this.prisma.aluno,
      params: typeof args,
    ) => Promise<Array<Record<string, unknown> & { _count?: Record<string, number | undefined> }>>;
    const grupos = await groupBy.call(this.prisma.aluno, args);

    return grupos.map((grupo) => ({
      label: this.valorRankingAluno(grupo[campo]),
      total: grupo._count?._all ?? 0,
    }));
  }

  private valorRankingAluno(value: unknown): string {
    return String(value ?? '').trim() || 'Nao informado';
  }

  private normalizarInteiroPositivo(value: string | number | undefined, fallback: number, max?: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    const inteiro = Math.floor(parsed);
    return max ? Math.min(inteiro, max) : inteiro;
  }

  private normalizarLimiteDetalhes(value?: number): number | undefined {
    if (!value) return undefined;
    if (!Number.isFinite(value) || value < 1) return undefined;
    return Math.floor(value);
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

export type {
  RelatorioExportacao,
  RelatorioImpactoSocial,
  RelatorioInstitucionalPdf,
  RelatorioRiscoEvasao,
  ResumoRelatorio,
};
