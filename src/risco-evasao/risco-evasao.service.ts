import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAcao,
  Prisma,
  Role,
  StatusAcaoRiscoEvasao,
} from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcaoRiscoEvasaoDto } from './dto/create-acao-risco-evasao.dto';
import { QueryAcoesRiscoEvasaoDto } from './dto/query-acoes-risco-evasao.dto';
import { UpdateAcaoRiscoEvasaoDto } from './dto/update-acao-risco-evasao.dto';

const STATUS_ACAO_ABERTA = [
  StatusAcaoRiscoEvasao.PENDENTE,
  StatusAcaoRiscoEvasao.EM_ANDAMENTO,
  StatusAcaoRiscoEvasao.SEM_CONTATO,
] as const;

const ACAO_RISCO_INCLUDE = {
  aluno: {
    select: {
      id: true,
      nomeCompleto: true,
      matricula: true,
    },
  },
  turma: {
    select: {
      id: true,
      nome: true,
      professorId: true,
      professor: { select: { id: true, nome: true } },
    },
  },
  responsavel: {
    select: {
      id: true,
      nome: true,
      role: true,
    },
  },
} satisfies Prisma.AcaoRiscoEvasaoInclude;

type AcaoRiscoComRelacoes = Prisma.AcaoRiscoEvasaoGetPayload<{ include: typeof ACAO_RISCO_INCLUDE }>;

@Injectable()
export class RiscoEvasaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: QueryAcoesRiscoEvasaoDto, user?: AuthenticatedUser) {
    this.validarPeriodo(query.dataInicio, query.dataFim);
    const { page, limit, skip } = this.normalizarPaginacao(query.page, query.limit);
    const where = this.montarWhere(query, user);

    const [data, total, pendentes, vencidas, resolvidasNoMes] = await Promise.all([
      this.prisma.acaoRiscoEvasao.findMany({
        where,
        include: ACAO_RISCO_INCLUDE,
        skip,
        take: limit,
        orderBy: [{ prazo: 'asc' }, { criadoEm: 'desc' }],
      }),
      this.prisma.acaoRiscoEvasao.count({ where }),
      this.prisma.acaoRiscoEvasao.count({
        where: { ...where, status: StatusAcaoRiscoEvasao.PENDENTE },
      }),
      this.prisma.acaoRiscoEvasao.count({
        where: {
          ...where,
          status: { in: [...STATUS_ACAO_ABERTA] },
          prazo: { lt: this.inicioDoDia(new Date()) },
        },
      }),
      this.prisma.acaoRiscoEvasao.count({
        where: {
          ...where,
          status: StatusAcaoRiscoEvasao.RESOLVIDA,
          resolvidoEm: {
            gte: this.inicioDoMes(new Date()),
            lte: this.fimDoDia(new Date()),
          },
        },
      }),
    ]);

    return {
      data: data.map((acao) => this.mapearAcao(acao)),
      indicadores: {
        pendentes,
        vencidas,
        resolvidasNoMes,
      },
      meta: {
        page,
        limit,
        total,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    return this.mapearAcao(await this.buscarAcaoOuFalhar(id, user));
  }

  async create(dto: CreateAcaoRiscoEvasaoDto, user?: AuthenticatedUser, auditUser?: AuditUser) {
    const motivoRisco = this.normalizarTextoObrigatorio(dto.motivoRisco, 'Informe o motivo do risco.');
    await this.validarReferencias(dto.alunoId, dto.turmaId, dto.responsavelId);

    const duplicada = await this.prisma.acaoRiscoEvasao.findFirst({
      where: {
        alunoId: dto.alunoId,
        turmaId: dto.turmaId ?? null,
        motivoRisco,
        status: { in: [...STATUS_ACAO_ABERTA] },
      },
      select: { id: true },
    });

    if (duplicada) {
      throw new BadRequestException('Já existe ação aberta para este aluno/turma com o mesmo motivo de risco.');
    }

    const acao = await this.prisma.acaoRiscoEvasao.create({
      data: {
        alunoId: dto.alunoId,
        turmaId: dto.turmaId,
        responsavelId: dto.responsavelId,
        nivel: dto.nivel,
        tipoAcao: dto.tipoAcao,
        motivoRisco,
        descricao: this.normalizarTextoOpcional(dto.descricao),
        prazo: dto.prazo ? this.fimDoDia(new Date(dto.prazo)) : undefined,
        criadoPorId: auditUser?.sub || user?.sub,
      },
      include: ACAO_RISCO_INCLUDE,
    });

    await this.registrarAuditoria(acao.id, AuditAcao.CRIAR, auditUser, undefined, acao);
    return this.mapearAcao(acao);
  }

  async update(id: string, dto: UpdateAcaoRiscoEvasaoDto, auditUser?: AuditUser) {
    const atual = await this.buscarAcaoOuFalhar(id);
    if (dto.responsavelId) await this.validarResponsavel(dto.responsavelId);

    const resultado = dto.resultado !== undefined ? this.normalizarTextoOpcional(dto.resultado) : atual.resultado;
    if (dto.status === StatusAcaoRiscoEvasao.RESOLVIDA && !resultado) {
      throw new BadRequestException('Informe o resultado antes de marcar a ação como resolvida.');
    }

    const data: Prisma.AcaoRiscoEvasaoUpdateInput = {};
    if (dto.responsavelId !== undefined) {
      data.responsavel = dto.responsavelId ? { connect: { id: dto.responsavelId } } : { disconnect: true };
    }
    if (dto.tipoAcao !== undefined) data.tipoAcao = dto.tipoAcao;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.resolvidoEm =
        dto.status === StatusAcaoRiscoEvasao.RESOLVIDA ? (atual.resolvidoEm ?? new Date()) : null;
    }
    if (dto.descricao !== undefined) data.descricao = this.normalizarTextoOpcional(dto.descricao);
    if (dto.resultado !== undefined) data.resultado = resultado;
    if (dto.prazo !== undefined) data.prazo = dto.prazo ? this.fimDoDia(new Date(dto.prazo)) : null;

    const atualizado = await this.prisma.acaoRiscoEvasao.update({
      where: { id },
      data,
      include: ACAO_RISCO_INCLUDE,
    });

    await this.registrarAuditoria(id, AuditAcao.ATUALIZAR, auditUser, atual, atualizado);
    return this.mapearAcao(atualizado);
  }

  async updateStatus(id: string, dto: UpdateAcaoRiscoEvasaoDto, auditUser?: AuditUser) {
    if (!dto.status) {
      throw new BadRequestException('Informe o status da ação.');
    }
    return this.update(
      id,
      {
        status: dto.status,
        resultado: dto.resultado,
      },
      auditUser,
    );
  }

  async remove(id: string, auditUser?: AuditUser) {
    const atual = await this.buscarAcaoOuFalhar(id);
    const cancelada = await this.prisma.acaoRiscoEvasao.update({
      where: { id },
      data: {
        status: StatusAcaoRiscoEvasao.CANCELADA,
        resolvidoEm: null,
      },
      include: ACAO_RISCO_INCLUDE,
    });

    await this.registrarAuditoria(id, AuditAcao.EXCLUIR, auditUser, atual, cancelada);
    return this.mapearAcao(cancelada);
  }

  private montarWhere(query: QueryAcoesRiscoEvasaoDto, user?: AuthenticatedUser): Prisma.AcaoRiscoEvasaoWhereInput {
    const where: Prisma.AcaoRiscoEvasaoWhereInput = {
      ...(query.alunoId && { alunoId: query.alunoId }),
      ...(query.turmaId && { turmaId: query.turmaId }),
      ...(query.responsavelId && { responsavelId: query.responsavelId }),
      ...(query.nivel && { nivel: query.nivel }),
      ...(query.status && { status: query.status }),
    };

    if (query.dataInicio || query.dataFim) {
      where.criadoEm = {
        ...(query.dataInicio && { gte: this.inicioDoDia(new Date(query.dataInicio)) }),
        ...(query.dataFim && { lte: this.fimDoDia(new Date(query.dataFim)) }),
      };
    }

    if (user?.role === Role.PROFESSOR) {
      return {
        AND: [
          where,
          {
            turma: {
              OR: [{ professorId: user.sub }, { professorAuxiliarId: user.sub }],
            },
          },
        ],
      };
    }

    return where;
  }

  private async buscarAcaoOuFalhar(id: string, user?: AuthenticatedUser): Promise<AcaoRiscoComRelacoes> {
    const acao = await this.prisma.acaoRiscoEvasao.findFirst({
      where: {
        id,
        ...(user?.role === Role.PROFESSOR && {
          turma: {
            OR: [{ professorId: user.sub }, { professorAuxiliarId: user.sub }],
          },
        }),
      },
      include: ACAO_RISCO_INCLUDE,
    });

    if (!acao) throw new NotFoundException('Ação de risco de evasão não encontrada.');
    return acao;
  }

  private async validarReferencias(alunoId: string, turmaId?: string, responsavelId?: string): Promise<void> {
    const [aluno, turma] = await Promise.all([
      this.prisma.aluno.findFirst({ where: { id: alunoId, excluido: false }, select: { id: true } }),
      turmaId
        ? this.prisma.turma.findFirst({ where: { id: turmaId, excluido: false }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    if (!aluno) throw new BadRequestException('Aluno informado não foi encontrado.');
    if (turmaId && !turma) throw new BadRequestException('Turma informada não foi encontrada.');
    if (responsavelId) await this.validarResponsavel(responsavelId);
  }

  private async validarResponsavel(responsavelId: string): Promise<void> {
    const responsavel = await this.prisma.user.findFirst({
      where: { id: responsavelId, statusAtivo: true, excluido: false },
      select: { id: true },
    });
    if (!responsavel) throw new BadRequestException('Responsável informado não foi encontrado ou está inativo.');
  }

  private mapearAcao(acao: AcaoRiscoComRelacoes) {
    return {
      ...acao,
      vencida: this.acaoVencida(acao),
    };
  }

  private acaoVencida(acao: Pick<AcaoRiscoComRelacoes, 'status' | 'prazo'>): boolean {
    return Boolean(acao.prazo && STATUS_ACAO_ABERTA.includes(acao.status as (typeof STATUS_ACAO_ABERTA)[number]) && acao.prazo < this.inicioDoDia(new Date()));
  }

  private normalizarPaginacao(pageValue?: number, limitValue?: number) {
    const page = Number.isFinite(Number(pageValue)) && Number(pageValue) > 0 ? Math.floor(Number(pageValue)) : 1;
    const limit = Number.isFinite(Number(limitValue)) && Number(limitValue) > 0 ? Math.min(100, Math.floor(Number(limitValue))) : 20;
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private validarPeriodo(dataInicio?: string, dataFim?: string): void {
    if (!dataInicio || !dataFim) return;
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    if (inicio > fim) throw new BadRequestException('Data inicial não pode ser maior que a data final.');
  }

  private normalizarTextoObrigatorio(value: string | undefined, mensagem: string): string {
    const texto = value?.trim();
    if (!texto) throw new BadRequestException(mensagem);
    return texto;
  }

  private normalizarTextoOpcional(value?: string | null): string | null {
    const texto = value?.trim();
    return texto || null;
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

  private inicioDoMes(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private async registrarAuditoria(
    registroId: string,
    acao: AuditAcao,
    auditUser?: AuditUser,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    await this.auditLogService.registrar({
      entidade: 'AcaoRiscoEvasao',
      registroId,
      acao,
      autorId: auditUser?.sub,
      autorNome: auditUser?.nome,
      autorRole: auditUser?.role,
      ip: auditUser?.ip,
      userAgent: auditUser?.userAgent,
      oldValue,
      newValue,
    });
  }
}
