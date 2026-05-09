import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  CategoriaArquivoAtendimentoIndividual,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
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
      ...(query.dataInicio || query.dataFim
        ? {
            dataAtendimento: {
              ...(query.dataInicio && { gte: this.parseDate(query.dataInicio) }),
              ...(query.dataFim && { lte: this.parseDate(query.dataFim) }),
            },
          }
        : {}),
    };

    if (query.tipoRegistro || query.dataInicio || query.dataFim) {
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

    return {
      filtros: query,
      totalAcompanhamentos: acompanhamentos.length,
      totalRegistros: atendimentos.length,
      totais,
      acompanhamentos: acompanhamentos.map((item) => this.sanitizer.sanitizarAcompanhamento(item)),
    };
  }

  async gerarPdf(query: FiltroRelatorioAtendimentoDto, authUser: AuthenticatedUser | undefined) {
    const relatorio = await this.gerar(query, authUser);
    return this.relatorioPdfService.gerar(relatorio, {
      emissorNome: authUser?.nome || authUser?.email || authUser?.sub,
      emissorPerfil: authUser?.role,
    });
  }

  private montarWhereAcompanhamento(
    query: Pick<FiltroRelatorioAtendimentoDto, 'alunoId' | 'professorId' | 'status'>,
    authUser?: AuthenticatedUser,
  ): Prisma.AcompanhamentoIndividualWhereInput {
    const statusArquivado = query.status === STATUS_ARQUIVADO_VIRTUAL;
    const where: Prisma.AcompanhamentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.alunoId && { alunoId: query.alunoId }),
      arquivado: statusArquivado,
      ...(query.status && !statusArquivado && { status: query.status as StatusAcompanhamentoIndividual }),
    };

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
}
