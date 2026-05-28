import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAcao, Prisma, Role, StatusPdi } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePdiDto } from './dto/create-pdi.dto';
import { CreatePdiEvolucaoDto } from './dto/create-pdi-evolucao.dto';
import { CreatePdiMetaDto } from './dto/create-pdi-meta.dto';
import { QueryPdiDto } from './dto/query-pdi.dto';
import { UpdatePdiDto } from './dto/update-pdi.dto';
import { UpdatePdiMetaDto } from './dto/update-pdi-meta.dto';
import { EventoLinhaTempoService } from '../aluno-linha-tempo/evento-linha-tempo.service';

const PDI_INCLUDE = {
  aluno: { select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true } },
  professorResponsavel: { select: { id: true, nome: true, role: true } },
  metas: { orderBy: [{ prazo: 'asc' }, { criadoEm: 'asc' }] },
  evolucoes: {
    orderBy: { dataRegistro: 'desc' },
    include: { registradoPor: { select: { id: true, nome: true, role: true } } },
  },
} satisfies Prisma.PdiAlunoInclude;

type PdiComRelacoes = Prisma.PdiAlunoGetPayload<{ include: typeof PDI_INCLUDE }>;

@Injectable()
export class PdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly eventoLinhaTempo?: EventoLinhaTempoService,
  ) {}

  async findAll(query: QueryPdiDto, user?: AuthenticatedUser) {
    this.validarPeriodo(query.dataInicio, query.dataFim);
    const { page, limit, skip } = this.normalizarPaginacao(query.page, query.limit);
    const where = this.montarWhere(query, user);

    const [data, total] = await Promise.all([
      this.prisma.pdiAluno.findMany({
        where,
        include: PDI_INCLUDE,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { atualizadoEm: 'desc' }],
      }),
      this.prisma.pdiAluno.count({ where }),
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

  async findOne(id: string, user?: AuthenticatedUser): Promise<PdiComRelacoes> {
    return this.buscarPdiOuFalhar(id, user);
  }

  async findByAluno(alunoId: string, user?: AuthenticatedUser): Promise<PdiComRelacoes[]> {
    await this.validarAluno(alunoId);
    await this.garantirAcessoAoAluno(alunoId, user);

    return this.prisma.pdiAluno.findMany({
      where: { alunoId },
      include: PDI_INCLUDE,
      orderBy: [{ dataInicio: 'desc' }, { criadoEm: 'desc' }],
    });
  }

  async findAtivoByAluno(alunoId: string, user?: AuthenticatedUser): Promise<PdiComRelacoes | null> {
    await this.validarAluno(alunoId);
    await this.garantirAcessoAoAluno(alunoId, user);

    return this.prisma.pdiAluno.findFirst({
      where: { alunoId, status: StatusPdi.ATIVO },
      include: PDI_INCLUDE,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async create(dto: CreatePdiDto, user?: AuthenticatedUser, auditUser?: AuditUser): Promise<PdiComRelacoes> {
    const alunoId = dto.alunoId;
    await this.validarAluno(alunoId);
    await this.garantirAcessoAoAluno(alunoId, user);

    const professorResponsavelId =
      dto.professorResponsavelId || (user?.role === Role.PROFESSOR ? user.sub : undefined);
    if (professorResponsavelId) await this.validarProfessorResponsavel(professorResponsavelId);

    const ativo = await this.prisma.pdiAluno.findFirst({
      where: { alunoId, status: StatusPdi.ATIVO },
      select: { id: true, titulo: true },
    });
    if (ativo) {
      throw new BadRequestException(
        `Aluno ja possui PDI ativo (${ativo.titulo}). Conclua ou arquive o PDI anterior antes de criar outro.`,
      );
    }

    const pdi = await this.prisma.pdiAluno.create({
      data: {
        alunoId,
        professorResponsavelId,
        titulo: this.textoObrigatorio(dto.titulo, 'Informe o titulo do PDI.'),
        objetivoGeral: this.textoObrigatorio(dto.objetivoGeral, 'Informe o objetivo geral do PDI.'),
        diagnosticoInicial: this.textoOpcional(dto.diagnosticoInicial),
        necessidadesAcessibilidade: this.textoOpcional(dto.necessidadesAcessibilidade),
        recursosUtilizados: this.textoOpcional(dto.recursosUtilizados),
        observacoesGerais: this.textoOpcional(dto.observacoesGerais),
        dataInicio: dto.dataInicio ? this.inicioDoDia(new Date(dto.dataInicio)) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? this.fimDoDia(new Date(dto.dataFimPrevista)) : undefined,
        criadoPorId: auditUser?.sub || user?.sub,
      },
      include: PDI_INCLUDE,
    });

    await this.registrarAuditoria(pdi.id, AuditAcao.CRIAR, auditUser, undefined, pdi);
    await this.eventoLinhaTempo?.registrarEvento({
      alunoId: pdi.alunoId,
      usuarioId: auditUser?.sub || user?.sub,
      tipo: 'PDI_CRIADO',
      origem: 'PDI',
      origemId: pdi.id,
      chaveEvento: `PDI:${pdi.id}:CRIADO`,
      dataEvento: pdi.criadoEm,
      titulo: 'PDI criado',
      descricao: pdi.objetivoGeral,
      professorNomeSnapshot: pdi.professorResponsavel?.nome,
      usuarioNomeSnapshot: auditUser?.nome,
      metadata: {
        status: pdi.status,
        titulo: pdi.titulo,
      },
    });
    return pdi;
  }

  async update(id: string, dto: UpdatePdiDto, user?: AuthenticatedUser, auditUser?: AuditUser): Promise<PdiComRelacoes> {
    const atual = await this.buscarPdiOuFalhar(id, user);
    if (dto.professorResponsavelId) await this.validarProfessorResponsavel(dto.professorResponsavelId);

    const dataConclusao = dto.dataConclusao
      ? this.fimDoDia(new Date(dto.dataConclusao))
      : atual.dataConclusao;
    if (dto.status === StatusPdi.CONCLUIDO && !dataConclusao) {
      throw new BadRequestException('Informe a data de conclusao para concluir o PDI.');
    }

    const data: Prisma.PdiAlunoUpdateInput = {};
    if (dto.professorResponsavelId !== undefined) {
      data.professorResponsavel = dto.professorResponsavelId
        ? { connect: { id: dto.professorResponsavelId } }
        : { disconnect: true };
    }
    if (dto.titulo !== undefined) data.titulo = this.textoObrigatorio(dto.titulo, 'Informe o titulo do PDI.');
    if (dto.objetivoGeral !== undefined) {
      data.objetivoGeral = this.textoObrigatorio(dto.objetivoGeral, 'Informe o objetivo geral do PDI.');
    }
    if (dto.diagnosticoInicial !== undefined) data.diagnosticoInicial = this.textoOpcional(dto.diagnosticoInicial);
    if (dto.necessidadesAcessibilidade !== undefined) {
      data.necessidadesAcessibilidade = this.textoOpcional(dto.necessidadesAcessibilidade);
    }
    if (dto.recursosUtilizados !== undefined) data.recursosUtilizados = this.textoOpcional(dto.recursosUtilizados);
    if (dto.observacoesGerais !== undefined) data.observacoesGerais = this.textoOpcional(dto.observacoesGerais);
    if (dto.dataInicio !== undefined) data.dataInicio = this.inicioDoDia(new Date(dto.dataInicio));
    if (dto.dataFimPrevista !== undefined) {
      data.dataFimPrevista = dto.dataFimPrevista ? this.fimDoDia(new Date(dto.dataFimPrevista)) : null;
    }
    if (dto.dataConclusao !== undefined) {
      data.dataConclusao = dto.dataConclusao ? this.fimDoDia(new Date(dto.dataConclusao)) : null;
    }
    if (dto.status !== undefined) data.status = dto.status;

    const atualizado = await this.prisma.pdiAluno.update({
      where: { id },
      data,
      include: PDI_INCLUDE,
    });

    await this.registrarAuditoria(id, AuditAcao.ATUALIZAR, auditUser, atual, atualizado);
    if (dto.status === StatusPdi.CONCLUIDO && atual.status !== StatusPdi.CONCLUIDO) {
      await this.eventoLinhaTempo?.registrarEvento({
        alunoId: atualizado.alunoId,
        usuarioId: auditUser?.sub || user?.sub,
        tipo: 'PDI_EVOLUCAO',
        origem: 'PDI',
        origemId: atualizado.id,
        chaveEvento: `PDI:${atualizado.id}:CONCLUIDO`,
        dataEvento: atualizado.dataConclusao ?? atualizado.atualizadoEm,
        titulo: 'PDI concluido',
        descricao: atualizado.objetivoGeral,
        professorNomeSnapshot: atualizado.professorResponsavel?.nome,
        usuarioNomeSnapshot: auditUser?.nome,
        metadata: {
          status: atualizado.status,
          titulo: atualizado.titulo,
        },
      });
    }
    return atualizado;
  }

  async remove(id: string, user?: AuthenticatedUser, auditUser?: AuditUser): Promise<PdiComRelacoes> {
    const atual = await this.buscarPdiOuFalhar(id, user);
    const arquivado = await this.prisma.pdiAluno.update({
      where: { id },
      data: { status: StatusPdi.ARQUIVADO },
      include: PDI_INCLUDE,
    });

    await this.registrarAuditoria(id, AuditAcao.ARQUIVAR, auditUser, atual, arquivado);
    return arquivado;
  }

  async createMeta(id: string, dto: CreatePdiMetaDto, user?: AuthenticatedUser, auditUser?: AuditUser) {
    const pdi = await this.buscarPdiEditavelOuFalhar(id, user);
    const meta = await this.prisma.pdiMeta.create({
      data: {
        pdiId: pdi.id,
        area: dto.area,
        descricao: this.textoObrigatorio(dto.descricao, 'Informe a descricao da meta.'),
        estrategia: this.textoOpcional(dto.estrategia),
        prazo: dto.prazo ? this.fimDoDia(new Date(dto.prazo)) : undefined,
      },
    });

    await this.registrarAuditoria(meta.id, AuditAcao.CRIAR, auditUser, undefined, meta);
    await this.eventoLinhaTempo?.registrarEvento({
      alunoId: pdi.alunoId,
      usuarioId: auditUser?.sub || user?.sub,
      tipo: 'PDI_META_CRIADA',
      origem: 'PDI_META',
      origemId: meta.id,
      chaveEvento: `PDI_META:${meta.id}:CRIADA`,
      dataEvento: meta.criadoEm,
      titulo: 'Meta do PDI criada',
      descricao: meta.descricao,
      professorNomeSnapshot: pdi.professorResponsavel?.nome,
      usuarioNomeSnapshot: auditUser?.nome,
      metadata: {
        area: meta.area,
        status: meta.status,
        pdiId: pdi.id,
        prazo: meta.prazo?.toISOString(),
      },
    });
    return meta;
  }

  async updateMeta(
    id: string,
    metaId: string,
    dto: UpdatePdiMetaDto,
    user?: AuthenticatedUser,
    auditUser?: AuditUser,
  ) {
    const pdi = await this.buscarPdiEditavelOuFalhar(id, user);
    const atual = await this.buscarMetaOuFalhar(id, metaId);

    const meta = await this.prisma.pdiMeta.update({
      where: { id: metaId },
      data: {
        ...(dto.area !== undefined && { area: dto.area }),
        ...(dto.descricao !== undefined && {
          descricao: this.textoObrigatorio(dto.descricao, 'Informe a descricao da meta.'),
        }),
        ...(dto.estrategia !== undefined && { estrategia: this.textoOpcional(dto.estrategia) }),
        ...(dto.prazo !== undefined && { prazo: dto.prazo ? this.fimDoDia(new Date(dto.prazo)) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    await this.registrarAuditoria(metaId, AuditAcao.ATUALIZAR, auditUser, atual, meta);
    await this.eventoLinhaTempo?.registrarEvento({
      alunoId: pdi.alunoId,
      usuarioId: auditUser?.sub || user?.sub,
      tipo: 'PDI_META_ATUALIZADA',
      origem: 'PDI_META',
      origemId: meta.id,
      chaveEvento: `PDI_META:${meta.id}:ATUALIZADA:${meta.atualizadoEm.toISOString()}`,
      dataEvento: meta.atualizadoEm,
      titulo: 'Meta do PDI atualizada',
      descricao: meta.descricao,
      professorNomeSnapshot: pdi.professorResponsavel?.nome,
      usuarioNomeSnapshot: auditUser?.nome,
      metadata: {
        area: meta.area,
        status: meta.status,
        pdiId: pdi.id,
        prazo: meta.prazo?.toISOString(),
      },
    });
    return meta;
  }

  async deleteMeta(id: string, metaId: string, user?: AuthenticatedUser, auditUser?: AuditUser) {
    await this.buscarPdiEditavelOuFalhar(id, user);
    const atual = await this.buscarMetaOuFalhar(id, metaId);
    await this.prisma.pdiMeta.delete({ where: { id: metaId } });
    await this.registrarAuditoria(metaId, AuditAcao.EXCLUIR, auditUser, atual, undefined);
    return { id: metaId };
  }

  async createEvolucao(
    id: string,
    dto: CreatePdiEvolucaoDto,
    user?: AuthenticatedUser,
    auditUser?: AuditUser,
  ) {
    const pdi = await this.buscarPdiEditavelOuFalhar(id, user);
    const evolucao = await this.prisma.pdiEvolucao.create({
      data: {
        pdiId: pdi.id,
        dataRegistro: dto.dataRegistro ? this.inicioDoDia(new Date(dto.dataRegistro)) : undefined,
        descricao: this.textoObrigatorio(dto.descricao, 'Informe a descricao da evolucao.'),
        dificuldades: this.textoOpcional(dto.dificuldades),
        avancos: this.textoOpcional(dto.avancos),
        proximosPassos: this.textoOpcional(dto.proximosPassos),
        registradoPorId: auditUser?.sub || user?.sub,
      },
      include: { registradoPor: { select: { id: true, nome: true, role: true } } },
    });

    await this.registrarAuditoria(evolucao.id, AuditAcao.CRIAR, auditUser, undefined, evolucao);
    await this.eventoLinhaTempo?.registrarEvento({
      alunoId: pdi.alunoId,
      usuarioId: auditUser?.sub || user?.sub,
      tipo: 'PDI_EVOLUCAO',
      origem: 'PDI_EVOLUCAO',
      origemId: evolucao.id,
      chaveEvento: `PDI_EVOLUCAO:${evolucao.id}:CRIADA`,
      dataEvento: evolucao.dataRegistro,
      titulo: 'Evolucao registrada no PDI',
      descricao: evolucao.avancos || evolucao.descricao,
      professorNomeSnapshot: pdi.professorResponsavel?.nome,
      usuarioNomeSnapshot: auditUser?.nome || evolucao.registradoPor?.nome,
      metadata: {
        pdiId: pdi.id,
      },
    });
    return evolucao;
  }

  async listEvolucoes(id: string, user?: AuthenticatedUser) {
    await this.buscarPdiOuFalhar(id, user);
    return this.prisma.pdiEvolucao.findMany({
      where: { pdiId: id },
      include: { registradoPor: { select: { id: true, nome: true, role: true } } },
      orderBy: { dataRegistro: 'desc' },
    });
  }

  async deleteEvolucao(id: string, evolucaoId: string, user?: AuthenticatedUser, auditUser?: AuditUser) {
    await this.buscarPdiEditavelOuFalhar(id, user);
    const atual = await this.prisma.pdiEvolucao.findFirst({ where: { id: evolucaoId, pdiId: id } });
    if (!atual) throw new NotFoundException('Evolucao do PDI nao encontrada.');

    await this.prisma.pdiEvolucao.delete({ where: { id: evolucaoId } });
    await this.registrarAuditoria(evolucaoId, AuditAcao.EXCLUIR, auditUser, atual, undefined);
    return { id: evolucaoId };
  }

  private montarWhere(query: QueryPdiDto, user?: AuthenticatedUser): Prisma.PdiAlunoWhereInput {
    const where: Prisma.PdiAlunoWhereInput = {
      ...(query.alunoId && { alunoId: query.alunoId }),
      ...(query.professorResponsavelId && { professorResponsavelId: query.professorResponsavelId }),
      ...(query.status && { status: query.status }),
      ...(query.busca && {
        OR: [
          { titulo: { contains: query.busca, mode: Prisma.QueryMode.insensitive } },
          { objetivoGeral: { contains: query.busca, mode: Prisma.QueryMode.insensitive } },
          { aluno: { nomeCompleto: { contains: query.busca, mode: Prisma.QueryMode.insensitive } } },
        ],
      }),
    };

    if (query.dataInicio || query.dataFim) {
      where.dataInicio = {
        ...(query.dataInicio && { gte: this.inicioDoDia(new Date(query.dataInicio)) }),
        ...(query.dataFim && { lte: this.fimDoDia(new Date(query.dataFim)) }),
      };
    }

    if (user?.role === Role.PROFESSOR) {
      return {
        AND: [where, this.whereProfessor(user.sub)],
      };
    }

    return where;
  }

  private async buscarPdiOuFalhar(id: string, user?: AuthenticatedUser): Promise<PdiComRelacoes> {
    const pdi = await this.prisma.pdiAluno.findFirst({
      where: {
        id,
        ...(user?.role === Role.PROFESSOR && this.whereProfessor(user.sub)),
      },
      include: PDI_INCLUDE,
    });
    if (!pdi) throw new NotFoundException('PDI nao encontrado.');
    return pdi;
  }

  private async buscarPdiEditavelOuFalhar(id: string, user?: AuthenticatedUser): Promise<PdiComRelacoes> {
    const pdi = await this.buscarPdiOuFalhar(id, user);
    if (pdi.status === StatusPdi.ARQUIVADO || pdi.status === StatusPdi.CONCLUIDO) {
      throw new BadRequestException('PDI concluido ou arquivado nao permite novas alteracoes.');
    }
    return pdi;
  }

  private async buscarMetaOuFalhar(pdiId: string, metaId: string) {
    const meta = await this.prisma.pdiMeta.findFirst({ where: { id: metaId, pdiId } });
    if (!meta) throw new NotFoundException('Meta do PDI nao encontrada.');
    return meta;
  }

  private async validarAluno(alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findFirst({
      where: { id: alunoId, excluido: false },
      select: { id: true },
    });
    if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
  }

  private async validarProfessorResponsavel(professorResponsavelId: string): Promise<void> {
    const professor = await this.prisma.user.findFirst({
      where: {
        id: professorResponsavelId,
        role: Role.PROFESSOR,
        statusAtivo: true,
        excluido: false,
      },
      select: { id: true },
    });
    if (!professor) throw new BadRequestException('Professor responsavel nao encontrado ou inativo.');
  }

  private async garantirAcessoAoAluno(alunoId: string, user?: AuthenticatedUser): Promise<void> {
    if (user?.role !== Role.PROFESSOR) return;
    const vinculo = await this.prisma.matriculaOficina.findFirst({
      where: {
        alunoId,
        turma: {
          OR: [{ professorId: user.sub }, { professorAuxiliarId: user.sub }],
        },
      },
      select: { id: true },
    });
    if (!vinculo) throw new NotFoundException('Aluno nao encontrado para este professor.');
  }

  private whereProfessor(professorId: string): Prisma.PdiAlunoWhereInput {
    return {
      OR: [
        { professorResponsavelId: professorId },
        {
          aluno: {
            matriculasOficina: {
              some: {
                turma: {
                  OR: [{ professorId }, { professorAuxiliarId: professorId }],
                },
              },
            },
          },
        },
      ],
    };
  }

  private normalizarPaginacao(pageValue?: number, limitValue?: number) {
    const page = Number.isFinite(Number(pageValue)) && Number(pageValue) > 0 ? Math.floor(Number(pageValue)) : 1;
    const limit = Number.isFinite(Number(limitValue)) && Number(limitValue) > 0 ? Math.min(100, Math.floor(Number(limitValue))) : 20;
    return { page, limit, skip: (page - 1) * limit };
  }

  private validarPeriodo(dataInicio?: string, dataFim?: string): void {
    if (!dataInicio || !dataFim) return;
    if (new Date(dataInicio) > new Date(dataFim)) {
      throw new BadRequestException('Data inicial nao pode ser maior que a data final.');
    }
  }

  private textoObrigatorio(value: string | undefined, mensagem: string): string {
    const texto = value?.trim();
    if (!texto) throw new BadRequestException(mensagem);
    return texto;
  }

  private textoOpcional(value?: string | null): string | null {
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

  private async registrarAuditoria(
    registroId: string,
    acao: AuditAcao,
    auditUser?: AuditUser,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    await this.auditLogService.registrar({
      entidade: 'PdiAluno',
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
