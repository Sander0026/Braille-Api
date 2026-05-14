import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  CategoriaArquivoAtendimentoIndividual,
  Prisma,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { FiltroAcompanhamentoIndividualDto } from '../dto/filtro-acompanhamento-individual.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { VerificarDuplicidadeAcompanhamentoDto } from '../dto/verificar-duplicidade-acompanhamento.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisService } from './atendimentos-individuais.service';

@Injectable()
export class AcompanhamentosIndividuaisService {
  constructor(
    private readonly atendimentosService: AtendimentosIndividuaisService,
    private readonly prisma: PrismaService,
    private readonly policy: AtendimentosIndividuaisPolicy,
  ) {}

  criar(dto: CriarAcompanhamentoIndividualDto, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.criarAcompanhamento(dto, authUser, auditUser);
  }

  listar(query: FiltroAcompanhamentoIndividualDto, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.listarAcompanhamentos(query, authUser);
  }

  async dashboard(authUser: AuthenticatedUser | undefined) {
    if (!this.policy.canViewArchivedList(authUser)) {
      throw new ForbiddenException('Seu perfil nao tem permissao para consultar o dashboard administrativo.');
    }

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

    const acompanhamentoBase: Prisma.AcompanhamentoIndividualWhereInput = { excluidoEm: null };
    const atendimentoBase: Prisma.AtendimentoIndividualWhereInput = {
      excluidoEm: null,
      acompanhamento: acompanhamentoBase,
    };
    const atendimentoMes: Prisma.AtendimentoIndividualWhereInput = {
      ...atendimentoBase,
      dataAtendimento: { gte: inicioMes, lte: fimMes },
    };

    const [
      emAndamento,
      finalizados,
      arquivados,
      atendimentosNoMes,
      faltasComComprovante,
      faltasSemComprovante,
      totalAcompanhamentosNaoArquivados,
      totalAtendimentosNaoArquivados,
      porProfessorRaw,
      alunosRaw,
    ] = await Promise.all([
      this.prisma.acompanhamentoIndividual.count({
        where: { ...acompanhamentoBase, status: StatusAcompanhamentoIndividual.EM_ANDAMENTO, arquivado: false },
      }),
      this.prisma.acompanhamentoIndividual.count({
        where: { ...acompanhamentoBase, status: StatusAcompanhamentoIndividual.FINALIZADO, arquivado: false },
      }),
      this.prisma.acompanhamentoIndividual.count({ where: { ...acompanhamentoBase, arquivado: true } }),
      this.prisma.atendimentoIndividual.count({ where: atendimentoMes }),
      this.prisma.atendimentoIndividual.count({
        where: {
          ...atendimentoMes,
          tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA,
          arquivos: { some: { categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO, excluidoEm: null } },
        },
      }),
      this.prisma.atendimentoIndividual.count({
        where: {
          ...atendimentoMes,
          tipoRegistro: TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA,
          arquivos: { none: { categoria: CategoriaArquivoAtendimentoIndividual.ATESTADO, excluidoEm: null } },
        },
      }),
      this.prisma.acompanhamentoIndividual.count({ where: { ...acompanhamentoBase, arquivado: false } }),
      this.prisma.atendimentoIndividual.count({
        where: { ...atendimentoBase, acompanhamento: { ...acompanhamentoBase, arquivado: false } },
      }),
      this.prisma.atendimentoIndividual.groupBy({
        by: ['professorId'],
        where: atendimentoMes,
        _count: { _all: true },
        orderBy: { _count: { professorId: 'desc' } },
        take: 5,
      }),
      this.prisma.atendimentoIndividual.groupBy({
        by: ['alunoId'],
        where: atendimentoMes,
        _count: { _all: true },
        orderBy: { _count: { alunoId: 'desc' } },
        take: 5,
      }),
    ]);

    const [professores, alunos] = await Promise.all([
      porProfessorRaw.length
        ? this.prisma.user.findMany({
            where: { id: { in: porProfessorRaw.map((item) => item.professorId) } },
            select: { id: true, nome: true, matricula: true },
          })
        : [],
      alunosRaw.length
        ? this.prisma.aluno.findMany({
            where: { id: { in: alunosRaw.map((item) => item.alunoId) } },
            select: { id: true, nomeCompleto: true, matricula: true },
          })
        : [],
    ]);

    return {
      periodo: {
        inicio: inicioMes.toISOString().slice(0, 10),
        fim: fimMes.toISOString().slice(0, 10),
      },
      indicadores: {
        emAndamento,
        finalizados,
        arquivados,
        atendimentosNoMes,
        faltasJustificadasComComprovante: faltasComComprovante,
        faltasJustificadasSemComprovante: faltasSemComprovante,
        mediaAtendimentosPorAcompanhamento: totalAcompanhamentosNaoArquivados
          ? Number((totalAtendimentosNaoArquivados / totalAcompanhamentosNaoArquivados).toFixed(1))
          : 0,
      },
      atendimentosPorProfessor: porProfessorRaw.map((item) => {
        const professor = professores.find((prof) => prof.id === item.professorId);
        return {
          professorId: item.professorId,
          nome: professor?.nome ?? 'Professor nao encontrado',
          matricula: professor?.matricula ?? null,
          total: item._count._all,
        };
      }),
      alunosMaisAtendidos: alunosRaw.map((item) => {
        const aluno = alunos.find((registro) => registro.id === item.alunoId);
        return {
          alunoId: item.alunoId,
          nome: aluno?.nomeCompleto ?? 'Aluno nao encontrado',
          matricula: aluno?.matricula ?? null,
          total: item._count._all,
        };
      }),
    };
  }

  verificarDuplicidade(query: VerificarDuplicidadeAcompanhamentoDto, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.verificarDuplicidadeAcompanhamento(query, authUser);
  }

  buscar(id: string, authUser: AuthenticatedUser | undefined) {
    return this.atendimentosService.buscarAcompanhamento(id, authUser);
  }

  atualizarAssunto(
    id: string,
    dto: AtualizarAssuntoAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    return this.atendimentosService.atualizarAssunto(id, dto, authUser, auditUser);
  }

  finalizar(id: string, dto: FinalizarAcompanhamentoDto, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.finalizarAcompanhamento(id, dto, authUser, auditUser);
  }

  reabrir(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.reabrirAcompanhamento(id, authUser, auditUser);
  }

  arquivar(id: string, motivo: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.arquivarAcompanhamento(id, motivo, authUser, auditUser);
  }

  desarquivar(id: string, motivo: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    return this.atendimentosService.desarquivarAcompanhamento(id, motivo, authUser, auditUser);
  }
}
