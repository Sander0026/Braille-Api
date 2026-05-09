import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAcao,
  CategoriaArquivoAtendimentoIndividual,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { UploadService } from '../../upload/upload.service';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { FiltroAcompanhamentoIndividualDto } from '../dto/filtro-acompanhamento-individual.dto';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';

const ACOMPANHAMENTO_INCLUDE = {
  aluno: { select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true } },
  professor: { select: { id: true, nome: true, matricula: true, role: true } },
  _count: { select: { atendimentos: true } },
} as const;

const ACOMPANHAMENTO_DETALHE_INCLUDE = {
  ...ACOMPANHAMENTO_INCLUDE,
  atendimentos: {
    where: { excluidoEm: null },
    include: { arquivos: true },
    orderBy: { dataAtendimento: 'desc' },
  },
  historicoAssuntos: {
    include: { alteradoPor: { select: { id: true, nome: true, role: true } } },
    orderBy: { criadoEm: 'desc' },
  },
} as const;

@Injectable()
export class AtendimentosIndividuaisService {
  private readonly logger = new Logger(AtendimentosIndividuaisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
    private readonly uploadService: UploadService,
    private readonly policy: AtendimentosIndividuaisPolicy,
  ) {}

  async criarAcompanhamento(
    dto: CriarAcompanhamentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    this.policy.assertCanCreate(authUser);

    const professorId = this.resolverProfessorId(dto.professorId, authUser);

    if (dto.primeiroAtendimento) {
      this.policy.assertCanCreateAtendimento(authUser, { professorId });
    }

    await Promise.all([
      this.validarAlunoAtivo(dto.alunoId),
      this.validarProfessorAtivo(professorId),
    ]);

    if (dto.primeiroAtendimento) {
      this.validarRegraAtendimento(dto.primeiroAtendimento);
    }

    const acompanhamento = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.acompanhamentoIndividual.create({
        data: {
          alunoId: dto.alunoId,
          professorId,
          assuntoAtual: dto.assuntoAtual,
          descricao: dto.descricao,
          ...(dto.primeiroAtendimento && {
            atendimentos: {
              create: {
                alunoId: dto.alunoId,
                professorId,
                dataAtendimento: this.parseDate(dto.primeiroAtendimento.dataAtendimento),
                tipoRegistro: dto.primeiroAtendimento.tipoRegistro,
                assuntoDoDia: dto.primeiroAtendimento.assuntoDoDia,
                observacao: dto.primeiroAtendimento.observacao,
                evolucao: dto.primeiroAtendimento.evolucao,
                dificuldades: dto.primeiroAtendimento.dificuldades,
                pendencias: dto.primeiroAtendimento.pendencias,
                recomendacoes: dto.primeiroAtendimento.recomendacoes,
              },
            },
          }),
        },
        include: ACOMPANHAMENTO_DETALHE_INCLUDE,
      });

      return criado;
    });

    this.registrarAuditoria('AcompanhamentoIndividual', acompanhamento.id, AuditAcao.CRIAR, auditUser, undefined, {
      alunoId: acompanhamento.alunoId,
      professorId: acompanhamento.professorId,
      status: acompanhamento.status,
      dataInicio: acompanhamento.dataInicio,
      possuiPrimeiroAtendimento: Boolean(dto.primeiroAtendimento),
    });
    return acompanhamento;
  }

  async listarAcompanhamentos(query: FiltroAcompanhamentoIndividualDto, authUser?: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.montarWhereAcompanhamento(query, authUser);

    const [data, total] = await Promise.all([
      this.prisma.acompanhamentoIndividual.findMany({
        where,
        skip,
        take: limit,
        include: ACOMPANHAMENTO_INCLUDE,
        orderBy: { atualizadoEm: 'desc' },
      }),
      this.prisma.acompanhamentoIndividual.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async buscarAcompanhamento(id: string, authUser?: AuthenticatedUser) {
    const acompanhamento = await this.prisma.acompanhamentoIndividual.findFirst({
      where: { id, excluidoEm: null },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    if (!acompanhamento) throw new NotFoundException('Acompanhamento individual nao encontrado.');
    this.policy.assertCanView(authUser, acompanhamento);
    return acompanhamento;
  }

  async atualizarAssunto(
    id: string,
    dto: AtualizarAssuntoAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanUpdateSubject(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Nao e possivel alterar assunto de acompanhamento finalizado ou arquivado.');
    }

    if (acompanhamento.assuntoAtual === dto.assuntoAtual) return acompanhamento;

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        assuntoAtual: dto.assuntoAtual,
        historicoAssuntos: {
          create: {
            assuntoAnterior: acompanhamento.assuntoAtual,
            assuntoNovo: dto.assuntoAtual,
            motivoAlteracao: dto.motivoAlteracao,
            alteradoPorId: auditUser.sub || undefined,
          },
        },
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.ATUALIZAR, auditUser, {
      assuntoAtual: acompanhamento.assuntoAtual,
    }, {
      assuntoAtual: atualizado.assuntoAtual,
      motivoAlteracao: dto.motivoAlteracao,
    });
    return atualizado;
  }

  async finalizarAcompanhamento(
    id: string,
    dto: FinalizarAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanFinish(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Acompanhamento individual ja esta finalizado ou arquivado.');
    }

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: StatusAcompanhamentoIndividual.FINALIZADO,
        dataFinalizacao: new Date(),
        resultadoFinal: dto.resultadoFinal,
        resumoFinal: dto.resumoFinal,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      dataFinalizacao: atualizado.dataFinalizacao,
    });
    return atualizado;
  }

  async reabrirAcompanhamento(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanReopen(authUser);

    if (acompanhamento.status === StatusAcompanhamentoIndividual.EM_ANDAMENTO) return acompanhamento;

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
        dataFinalizacao: null,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
      dataFinalizacao: acompanhamento.dataFinalizacao,
    }, {
      status: atualizado.status,
      dataFinalizacao: atualizado.dataFinalizacao,
    });
    return atualizado;
  }

  async criarAtendimento(
    acompanhamentoId: string,
    dto: CriarAtendimentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    this.validarRegraAtendimento(dto);
    const acompanhamento = await this.buscarAcompanhamento(acompanhamentoId, authUser);
    this.policy.assertCanCreateAtendimento(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Nao e possivel registrar atendimento em acompanhamento finalizado ou arquivado.');
    }

    const atendimento = await this.prisma.atendimentoIndividual.create({
      data: {
        acompanhamentoId,
        alunoId: acompanhamento.alunoId,
        professorId: acompanhamento.professorId,
        dataAtendimento: this.parseDate(dto.dataAtendimento),
        tipoRegistro: dto.tipoRegistro,
        assuntoDoDia: dto.assuntoDoDia,
        observacao: dto.observacao,
        evolucao: dto.evolucao,
        dificuldades: dto.dificuldades,
        pendencias: dto.pendencias,
        recomendacoes: dto.recomendacoes,
      },
      include: { arquivos: true },
    });

    this.registrarAuditoria('AtendimentoIndividual', atendimento.id, AuditAcao.CRIAR, auditUser, undefined, {
      acompanhamentoId,
      alunoId: atendimento.alunoId,
      professorId: atendimento.professorId,
      tipoRegistro: atendimento.tipoRegistro,
      dataAtendimento: atendimento.dataAtendimento,
    });
    return atendimento;
  }

  async listarAtendimentos(acompanhamentoId: string, authUser?: AuthenticatedUser) {
    const acompanhamento = await this.buscarAcompanhamento(acompanhamentoId, authUser);
    this.policy.assertCanView(authUser, acompanhamento);

    return this.prisma.atendimentoIndividual.findMany({
      where: { acompanhamentoId, excluidoEm: null },
      include: { arquivos: true },
      orderBy: { dataAtendimento: 'desc' },
    });
  }

  async buscarAtendimento(id: string, authUser?: AuthenticatedUser) {
    const atendimento = await this.prisma.atendimentoIndividual.findFirst({
      where: { id, excluidoEm: null },
      include: {
        arquivos: true,
        acompanhamento: {
          include: {
            aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
            professor: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!atendimento) throw new NotFoundException('Atendimento individual nao encontrado.');
    this.policy.assertCanView(authUser, atendimento.acompanhamento);
    return atendimento;
  }

  async anexarArquivo(
    atendimentoId: string,
    file: Express.Multer.File,
    categoria: CategoriaArquivoAtendimentoIndividual,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const atendimento = await this.buscarAtendimento(atendimentoId, authUser);
    this.policy.assertCanAttachFile(authUser, atendimento.acompanhamento);

    const upload = await this.uploadService.uploadArquivoAtendimento(file, auditUser);
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.create({
      data: {
        atendimentoId,
        nomeOriginal: file.originalname,
        nomeArquivo: this.extrairNomeArquivo(upload.url) || file.originalname,
        urlArquivo: upload.url,
        tipoArquivo: file.mimetype,
        tamanho: Math.max(file.size ?? 0, file.buffer?.length ?? 0),
        categoria,
        criadoPorId: auditUser.sub || undefined,
      },
    });

    this.registrarAuditoria('ArquivoAtendimentoIndividual', arquivo.id, AuditAcao.CRIAR, auditUser, undefined, {
      atendimentoId,
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
      tamanho: arquivo.tamanho,
    });
    return arquivo;
  }

  async gerarRelatorio(query: FiltroRelatorioAtendimentoDto, authUser?: AuthenticatedUser) {
    if (!this.policy.canGenerateReport(authUser)) {
      throw new BadRequestException('Seu perfil nao tem permissao para gerar relatorio.');
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
          include: { arquivos: true },
          orderBy: { dataAtendimento: 'asc' },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const atendimentos = acompanhamentos.flatMap((item) => item.atendimentos);
    const totais = {
      atendimentosRealizados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO),
      faltasJustificadas: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA),
      faltasNaoJustificadas: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA),
      cancelados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.CANCELADO),
    };

    return {
      filtros: query,
      totalAcompanhamentos: acompanhamentos.length,
      totalRegistros: atendimentos.length,
      totais,
      acompanhamentos,
    };
  }

  private montarWhereAcompanhamento(
    query: Pick<FiltroAcompanhamentoIndividualDto, 'alunoId' | 'professorId' | 'status' | 'busca' | 'dataInicio' | 'dataFim'>,
    authUser?: AuthenticatedUser,
  ): Prisma.AcompanhamentoIndividualWhereInput {
    const where: Prisma.AcompanhamentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.alunoId && { alunoId: query.alunoId }),
      ...(query.status && { status: query.status }),
      ...(query.dataInicio || query.dataFim
        ? {
            dataInicio: {
              ...(query.dataInicio && { gte: this.parseDate(query.dataInicio) }),
              ...(query.dataFim && { lte: this.parseDate(query.dataFim) }),
            },
          }
        : {}),
    };

    if (authUser?.role === Role.PROFESSOR) {
      where.professorId = authUser.sub;
    } else if (query.professorId) {
      where.professorId = query.professorId;
    }

    if (query.busca?.trim()) {
      const busca = query.busca.trim();
      where.OR = [
        { assuntoAtual: { contains: busca, mode: 'insensitive' } },
        { aluno: { nomeCompleto: { contains: busca, mode: 'insensitive' } } },
        { aluno: { matricula: { contains: busca, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private resolverProfessorId(professorId: string | undefined, authUser?: AuthenticatedUser): string {
    if (authUser?.role === Role.PROFESSOR) return authUser.sub;
    if (professorId) return professorId;
    throw new BadRequestException('professorId e obrigatorio para ADMIN ou SECRETARIA.');
  }

  private async validarAlunoAtivo(alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { id: true, statusAtivo: true, excluido: true },
    });

    if (!aluno || aluno.excluido || !aluno.statusAtivo) {
      throw new NotFoundException('Aluno ativo nao encontrado.');
    }
  }

  private async validarProfessorAtivo(professorId: string): Promise<void> {
    const professor = await this.prisma.user.findUnique({
      where: { id: professorId },
      select: { id: true, role: true, statusAtivo: true, excluido: true },
    });

    if (!professor || professor.excluido || !professor.statusAtivo || professor.role !== Role.PROFESSOR) {
      throw new NotFoundException('Professor ativo nao encontrado.');
    }
  }

  private validarRegraAtendimento(dto: CriarAtendimentoIndividualDto): void {
    if (dto.tipoRegistro === TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO) {
      if (!dto.assuntoDoDia?.trim()) {
        throw new BadRequestException('assuntoDoDia e obrigatorio para atendimento realizado.');
      }
      if (!dto.observacao?.trim()) {
        throw new BadRequestException('observacao e obrigatoria para atendimento realizado.');
      }
    }

    if (dto.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA && !dto.observacao?.trim()) {
      throw new BadRequestException('observacao deve informar o motivo da falta justificada.');
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

  private validarPeriodoRelatorio(query: FiltroRelatorioAtendimentoDto): void {
    if (!query.dataInicio || !query.dataFim) return;

    const inicio = this.parseDate(query.dataInicio);
    const fim = this.parseDate(query.dataFim);
    if (inicio.getTime() > fim.getTime()) {
      throw new BadRequestException('dataInicio deve ser menor ou igual a dataFim.');
    }
  }

  private extrairNomeArquivo(url: string): string | null {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '');
    } catch {
      return null;
    }
  }

  private registrarAuditoria(
    entidade: string,
    registroId: string,
    acao: AuditAcao,
    auditUser: AuditUser,
    oldValue?: unknown,
    newValue?: unknown,
  ): void {
    this.auditService
      .registrar({
        entidade,
        registroId,
        acao,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue,
        newValue,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(`Falha na auditoria de ${entidade}/${registroId}: ${message}`);
      });
  }
}
