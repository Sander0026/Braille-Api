import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuditAcao,
  CategoriaArquivoAtendimentoIndividual,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUS_ARQUIVADO_VIRTUAL } from '../dto/filtro-acompanhamento-individual.dto';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisSanitizerService } from './atendimentos-individuais-sanitizer.service';
import { RelatorioAtendimentoPdfService } from './relatorio-atendimento-pdf.service';

@Injectable()
export class RelatoriosAtendimentosIndividuaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AtendimentosIndividuaisPolicy,
    private readonly sanitizer: AtendimentosIndividuaisSanitizerService,
    private readonly relatorioPdfService: RelatorioAtendimentoPdfService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async gerar(query: FiltroRelatorioAtendimentoDto, authUser: AuthenticatedUser | undefined) {
    if (!this.policy.canGenerateReport(authUser)) {
      throw new ForbiddenException('Seu perfil nao tem permissao para gerar relatorio.');
    }

    this.validarPeriodoRelatorio(query);

    const whereAcompanhamento = this.montarWhereAcompanhamento(
      {
        alunoId: query.alunoId,
        professorId: query.professorId,
        status: query.status,
      },
      authUser,
    );

    const whereAtendimento: Prisma.AtendimentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.tipoRegistro && { tipoRegistro: query.tipoRegistro }),
      ...(query.modalidade && { modalidade: query.modalidade }),
      ...(query.dataInicio || query.dataFim
        ? {
            dataAtendimento: {
              ...(query.dataInicio && { gte: this.parseDate(query.dataInicio) }),
              ...(query.dataFim && { lte: this.parseDate(query.dataFim) }),
            },
          }
        : {}),
    };

    if (query.tipoRegistro || query.modalidade || query.dataInicio || query.dataFim) {
      whereAcompanhamento.atendimentos = { some: whereAtendimento };
    }

    const acompanhamentos = await this.prisma.acompanhamentoIndividual.findMany({
      where: whereAcompanhamento,
      include: {
        aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
        professor: { select: { id: true, nome: true, matricula: true } },
        atendimentos: {
          where: whereAtendimento,
          include: { arquivos: { where: { excluidoEm: null } } },
          orderBy: { dataAtendimento: 'asc' },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const atendimentos = acompanhamentos.flatMap((item) => item.atendimentos);
    const faltasJustificadas = atendimentos.filter(
      (item) => item.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA,
    );
    const totais = {
      atendimentosRealizados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO),
      faltasJustificadas: faltasJustificadas.length,
      faltasJustificadasComComprovante: faltasJustificadas.filter((item) =>
        item.arquivos?.some((arquivo) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO),
      ).length,
      faltasJustificadasSemComprovante: faltasJustificadas.filter(
        (item) => !item.arquivos?.some((arquivo) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO),
      ).length,
      faltasNaoJustificadas: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA),
      cancelados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.CANCELADO),
    };
    const porStatusAcompanhamento = this.agruparPor(acompanhamentos, (item) =>
      item.arquivado ? STATUS_ARQUIVADO_VIRTUAL : item.status,
    );
    const porTipoRegistro = this.agruparPor(atendimentos, (item) => item.tipoRegistro);
    const porModalidade = this.agruparPor(atendimentos, (item) => item.modalidade ?? 'Nao informado');

    return {
      filtros: query,
      totalAcompanhamentos: acompanhamentos.length,
      totalRegistros: atendimentos.length,
      indicadores: {
        totalAcompanhamentos: acompanhamentos.length,
        emAndamento: porStatusAcompanhamento[StatusAcompanhamentoIndividual.EM_ANDAMENTO] ?? 0,
        finalizados: porStatusAcompanhamento[StatusAcompanhamentoIndividual.FINALIZADO] ?? 0,
        arquivados: porStatusAcompanhamento[STATUS_ARQUIVADO_VIRTUAL] ?? 0,
        totalAtendimentosRealizados: totais.atendimentosRealizados,
        faltasJustificadas: totais.faltasJustificadas,
        faltasNaoJustificadas: totais.faltasNaoJustificadas,
        atendimentosCancelados: totais.cancelados,
        mediaAtendimentosPorAluno: this.mediaPorAlunos(atendimentos),
        mediaDuracaoMinutos: this.mediaDuracao(atendimentos),
        porStatusAcompanhamento,
        porTipoRegistro,
        porModalidade,
      },
      atendimentosPorProfessor: this.rankingPorProfessor(atendimentos, acompanhamentos),
      alunosMaisAtendidos: this.rankingPorAluno(atendimentos, acompanhamentos),
      totais,
      acompanhamentos: acompanhamentos.map((item) => this.sanitizer.sanitizarAcompanhamento(item)),
    };
  }

  async gerarPdf(
    query: FiltroRelatorioAtendimentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser?: AuditUser,
  ) {
    const relatorio = await this.gerar(query, authUser);
    const buffer = await this.relatorioPdfService.gerar(relatorio, {
      emissorNome: authUser?.nome || authUser?.email || authUser?.sub,
      emissorPerfil: authUser?.role,
    });

    await this.registrarAuditoriaExportacaoPdf(query, authUser, auditUser);
    return buffer;
  }

  private montarWhereAcompanhamento(
    query: Pick<FiltroRelatorioAtendimentoDto, 'alunoId' | 'professorId' | 'status'>,
    authUser?: AuthenticatedUser,
  ): Prisma.AcompanhamentoIndividualWhereInput {
    const statusArquivado = query.status === STATUS_ARQUIVADO_VIRTUAL;
    const where: Prisma.AcompanhamentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.alunoId && { alunoId: query.alunoId }),
    };

    if (query.status) {
      where.arquivado = statusArquivado;
      if (!statusArquivado) {
        where.status = query.status as StatusAcompanhamentoIndividual;
      }
    }

    if (authUser?.role === Role.PROFESSOR) {
      where.professorId = authUser.sub;
    } else if (query.professorId) {
      where.professorId = query.professorId;
    }

    return where;
  }

  private validarPeriodoRelatorio(query: FiltroRelatorioAtendimentoDto): void {
    if (!query.dataInicio || !query.dataFim) return;

    const inicio = this.parseDate(query.dataInicio);
    const fim = this.parseDate(query.dataFim);
    if (inicio.getTime() > fim.getTime()) {
      throw new BadRequestException('dataInicio deve ser menor ou igual a dataFim.');
    }
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data invalida.');
    }
    return date;
  }

  private contar(
    atendimentos: Array<{ tipoRegistro: TipoRegistroAtendimentoIndividual }>,
    tipo: TipoRegistroAtendimentoIndividual,
  ): number {
    return atendimentos.filter((item) => item.tipoRegistro === tipo).length;
  }

  private async registrarAuditoriaExportacaoPdf(
    query: FiltroRelatorioAtendimentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser?: AuditUser,
  ): Promise<void> {
    await this.auditLogService.registrar({
      entidade: 'RelatorioAtendimentoIndividual',
      registroId: 'atendimentos-individuais',
      acao: AuditAcao.DOWNLOAD,
      autorId: auditUser?.sub || authUser?.sub,
      autorNome: auditUser?.nome || authUser?.nome || authUser?.email,
      autorRole: auditUser?.role || authUser?.role,
      ip: auditUser?.ip,
      userAgent: auditUser?.userAgent,
      newValue: {
        relatorio: 'Relatorio de Atendimentos Individuais',
        formato: 'PDF',
        filtros: this.filtrosAuditaveis(query),
        perfilExportador: authUser?.role,
        exportadoEm: new Date().toISOString(),
        observacaoLgpd: 'PDF do modulo de atendimentos individuais exportado por perfil autorizado.',
      },
    });
  }

  private filtrosAuditaveis(query: FiltroRelatorioAtendimentoDto): Record<string, string> {
    return Object.entries(query).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {});
  }

  private agruparPor<T>(items: T[], resolver: (item: T) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = resolver(item) || 'Nao informado';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private mediaPorAlunos(atendimentos: Array<{ alunoId: string }>): number {
    const alunos = new Set(atendimentos.map((item) => item.alunoId));
    if (!alunos.size) return 0;
    return Number((atendimentos.length / alunos.size).toFixed(2));
  }

  private mediaDuracao(atendimentos: Array<{ duracaoMinutos?: number | null }>): number {
    const duracoes = atendimentos
      .map((item) => item.duracaoMinutos)
      .filter((duracao): duracao is number => typeof duracao === 'number');
    if (!duracoes.length) return 0;
    const total = duracoes.reduce((sum, duracao) => sum + duracao, 0);
    return Number((total / duracoes.length).toFixed(2));
  }

  private rankingPorProfessor(
    atendimentos: Array<{ professorId: string }>,
    acompanhamentos: Array<{ professorId: string; professor?: { id: string; nome: string; matricula?: string | null } | null }>,
  ): Array<{ professorId: string; nome: string; matricula: string | null; total: number }> {
    const professores = new Map(acompanhamentos.map((item) => [item.professorId, item.professor]));
    return this.rankingPorId(atendimentos, (item) => item.professorId).map((item) => {
      const professor = professores.get(item.id);
      return {
        professorId: item.id,
        nome: professor?.nome ?? 'Professor nao encontrado',
        matricula: professor?.matricula ?? null,
        total: item.total,
      };
    });
  }

  private rankingPorAluno(
    atendimentos: Array<{ alunoId: string }>,
    acompanhamentos: Array<{ alunoId: string; aluno?: { id: string; nomeCompleto: string; matricula?: string | null } | null }>,
  ): Array<{ alunoId: string; nome: string; matricula: string | null; total: number }> {
    const alunos = new Map(acompanhamentos.map((item) => [item.alunoId, item.aluno]));
    return this.rankingPorId(atendimentos, (item) => item.alunoId).map((item) => {
      const aluno = alunos.get(item.id);
      return {
        alunoId: item.id,
        nome: aluno?.nomeCompleto ?? 'Aluno nao encontrado',
        matricula: aluno?.matricula ?? null,
        total: item.total,
      };
    });
  }

  private rankingPorId<T>(items: T[], resolver: (item: T) => string): Array<{ id: string; total: number }> {
    return Object.entries(this.agruparPor(items, resolver))
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }
}
