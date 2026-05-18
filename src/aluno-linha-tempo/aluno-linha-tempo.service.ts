import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  EventoLinhaTempoAluno,
  OrigemEventoLinhaTempo,
  Role,
  TipoEventoLinhaTempoAluno,
  VisibilidadeEventoLinhaTempo,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LinhaTempoAlunoItem, LinhaTempoAlunoResumo } from './aluno-linha-tempo.types';
import { CreateEventoLinhaTempoManualDto } from './dto/create-evento-linha-tempo-manual.dto';
import { QueryLinhaTempoAlunoDto } from './dto/query-linha-tempo-aluno.dto';
import { LinhaTempoBackfillService } from './linha-tempo-backfill.service';

type Periodo = {
  inicio?: Date;
  fim?: Date;
};

const TIPOS_LINHA_TEMPO = Object.values(TipoEventoLinhaTempoAluno);
const TIPOS_FREQUENCIA = [
  TipoEventoLinhaTempoAluno.FREQUENCIA_PRESENTE,
  TipoEventoLinhaTempoAluno.FREQUENCIA_FALTA,
  TipoEventoLinhaTempoAluno.FREQUENCIA_FALTA_JUSTIFICADA,
] as const;
const TIPOS_ATENDIMENTO = [
  TipoEventoLinhaTempoAluno.ATENDIMENTO_INDIVIDUAL,
  TipoEventoLinhaTempoAluno.FALTA_ATENDIMENTO,
] as const;
const TIPOS_PDI = [
  TipoEventoLinhaTempoAluno.PDI_CRIADO,
  TipoEventoLinhaTempoAluno.PDI_META_CRIADA,
  TipoEventoLinhaTempoAluno.PDI_META_ATUALIZADA,
  TipoEventoLinhaTempoAluno.PDI_EVOLUCAO,
] as const;
const TIPOS_ACAO_RISCO = [
  TipoEventoLinhaTempoAluno.ACAO_RISCO_EVASAO,
  TipoEventoLinhaTempoAluno.ACAO_RISCO_RESOLVIDA,
] as const;

@Injectable()
export class AlunoLinhaTempoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backfillService?: LinhaTempoBackfillService,
  ) {}

  async findByAluno(alunoId: string, query: QueryLinhaTempoAlunoDto, user?: AuthenticatedUser) {
    const { page, limit, skip } = this.normalizarPaginacao(query.page, query.limit);
    const periodo = this.normalizarPeriodo(query.dataInicio, query.dataFim);
    const tipos = this.normalizarTipos(query.tipo);

    const aluno = await this.prisma.aluno.findFirst({
      where: { id: alunoId, excluido: false },
      select: { id: true },
    });

    if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
    await this.garantirPermissao(alunoId, user);

    await this.garantirEventosPersistidos(alunoId);

    const where: Prisma.EventoLinhaTempoAlunoWhereInput = {
      alunoId,
      ...(tipos && { tipo: { in: tipos } }),
      ...(query.turmaId && { turmaId: query.turmaId }),
      dataEvento: this.periodoWhere(periodo),
      ...this.filtroPermissao(user),
    };

    const [total, eventos] = await this.prisma.$transaction([
      this.prisma.eventoLinhaTempoAluno.count({ where }),
      this.prisma.eventoLinhaTempoAluno.findMany({
        where,
        orderBy: { dataEvento: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: eventos.map((evento) => this.mapearEvento(evento, user)),
      meta: {
        page,
        limit,
        total,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async resumo(alunoId: string, user?: AuthenticatedUser): Promise<LinhaTempoAlunoResumo> {
    await this.buscarAlunoOuFalhar(alunoId);
    await this.garantirPermissao(alunoId, user);
    await this.garantirEventosPersistidos(alunoId);

    const whereBase: Prisma.EventoLinhaTempoAlunoWhereInput = {
      alunoId,
      ...this.filtroPermissao(user),
    };

    const [totalEventos, ultimaFrequencia, ultimoAtendimento, ultimoPdi, ultimaAcaoRisco] = await Promise.all([
      this.prisma.eventoLinhaTempoAluno.count({ where: whereBase }),
      this.buscarUltimaData(whereBase, [...TIPOS_FREQUENCIA]),
      this.buscarUltimaData(whereBase, [...TIPOS_ATENDIMENTO]),
      this.buscarUltimaData(whereBase, [...TIPOS_PDI]),
      this.buscarUltimaData(whereBase, [...TIPOS_ACAO_RISCO]),
    ]);

    return {
      totalEventos,
      ...(ultimaFrequencia && { ultimaFrequencia }),
      ...(ultimoAtendimento && { ultimoAtendimento }),
      ...(ultimoPdi && { ultimoPdi }),
      ...(ultimaAcaoRisco && { ultimaAcaoRisco }),
    };
  }

  async createManual(
    alunoId: string,
    dto: CreateEventoLinhaTempoManualDto,
    user?: AuthenticatedUser,
  ): Promise<LinhaTempoAlunoItem> {
    this.garantirUsuarioAutenticado(user);
    await this.buscarAlunoOuFalhar(alunoId);

    const titulo = this.normalizarTextoObrigatorio(dto.titulo, 'Informe o titulo do evento manual.');
    const descricao = this.normalizarTextoOpcional(dto.descricao);
    const dataEvento = dto.dataEvento ? new Date(dto.dataEvento) : new Date();
    if (Number.isNaN(dataEvento.getTime())) throw new BadRequestException('Data do evento invalida.');

    const turma = dto.turmaId ? await this.buscarTurmaDoAlunoOuFalhar(alunoId, dto.turmaId) : null;
    const evento = await this.prisma.eventoLinhaTempoAluno.create({
      data: {
        alunoId,
        turmaId: dto.turmaId,
        usuarioId: user?.sub,
        tipo: TipoEventoLinhaTempoAluno.OBSERVACAO_MANUAL,
        origem: OrigemEventoLinhaTempo.MANUAL,
        chaveEvento: `MANUAL:${randomUUID()}`,
        dataEvento,
        titulo,
        descricao,
        turmaNomeSnapshot: turma?.nome,
        professorNomeSnapshot: turma?.professor?.nome,
        usuarioNomeSnapshot: user?.nome ?? user?.email,
        metadata: {
          manual: true,
        },
        visibilidade: dto.sensivel ? VisibilidadeEventoLinhaTempo.RESTRITA : VisibilidadeEventoLinhaTempo.INTERNA,
        sensivel: dto.sensivel ?? false,
      },
    });

    return this.mapearEvento(evento);
  }

  async removeEventoManual(alunoId: string, eventoId: string, user?: AuthenticatedUser): Promise<LinhaTempoAlunoItem> {
    this.garantirUsuarioAutenticado(user);
    await this.buscarAlunoOuFalhar(alunoId);

    const evento = await this.prisma.eventoLinhaTempoAluno.findFirst({
      where: { id: eventoId, alunoId },
    });
    if (!evento) throw new NotFoundException('Evento da linha do tempo nao encontrado.');
    if (evento.tipo !== TipoEventoLinhaTempoAluno.OBSERVACAO_MANUAL || evento.origem !== OrigemEventoLinhaTempo.MANUAL) {
      throw new BadRequestException('Apenas eventos manuais podem ser removidos por este endpoint.');
    }

    const removido = await this.prisma.eventoLinhaTempoAluno.delete({ where: { id: evento.id } });
    return this.mapearEvento(removido);
  }

  private async buscarUltimaData(
    whereBase: Prisma.EventoLinhaTempoAlunoWhereInput,
    tipos: TipoEventoLinhaTempoAluno[],
  ): Promise<string | undefined> {
    const evento = await this.prisma.eventoLinhaTempoAluno.findFirst({
      where: {
        AND: [whereBase, { tipo: { in: tipos } }],
      },
      orderBy: { dataEvento: 'desc' },
      select: { dataEvento: true },
    });

    return evento?.dataEvento.toISOString();
  }

  private async buscarAlunoOuFalhar(alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findFirst({
      where: { id: alunoId, excluido: false },
      select: { id: true },
    });

    if (!aluno) throw new NotFoundException('Aluno nao encontrado.');
  }

  private async buscarTurmaDoAlunoOuFalhar(alunoId: string, turmaId: string) {
    const turma = await this.prisma.turma.findFirst({
      where: {
        id: turmaId,
        excluido: false,
        matriculasOficina: {
          some: { alunoId },
        },
      },
      select: {
        id: true,
        nome: true,
        professor: { select: { nome: true } },
      },
    });

    if (!turma) throw new NotFoundException('Turma nao encontrada para este aluno.');
    return turma;
  }

  private async garantirEventosPersistidos(alunoId: string): Promise<void> {
    const totalAluno = await this.prisma.eventoLinhaTempoAluno.count({ where: { alunoId } });
    if (totalAluno > 0) return;
    await this.backfillService?.backfillAluno(alunoId);
  }

  private filtroPermissao(user?: AuthenticatedUser): Prisma.EventoLinhaTempoAlunoWhereInput {
    if (!user) throw new ForbiddenException('Usuario nao autenticado.');
    if (user.role === Role.ADMIN || user.role === Role.SECRETARIA) return {};

    return {
      visibilidade: {
        in: [
          VisibilidadeEventoLinhaTempo.INTERNA,
          VisibilidadeEventoLinhaTempo.PROFESSOR,
          VisibilidadeEventoLinhaTempo.RESTRITA,
        ],
      },
    };
  }

  private async garantirPermissao(alunoId: string, user?: AuthenticatedUser): Promise<void> {
    if (!user) throw new ForbiddenException('Usuario nao autenticado.');
    if (user.role === Role.ADMIN || user.role === Role.SECRETARIA) return;
    if (user.role !== Role.PROFESSOR) throw new ForbiddenException('Perfil sem acesso a linha do tempo individual.');

    const vinculo = await this.prisma.aluno.findFirst({
      where: {
        id: alunoId,
        excluido: false,
        OR: [
          {
            matriculasOficina: {
              some: {
                turma: {
                  OR: [{ professorId: user.sub }, { professorAuxiliarId: user.sub }],
                },
              },
            },
          },
          { acompanhamentosIndividuais: { some: { professorId: user.sub, excluidoEm: null } } },
          { atendimentosIndividuais: { some: { professorId: user.sub, excluidoEm: null } } },
          { pdis: { some: { professorResponsavelId: user.sub } } },
        ],
      },
      select: { id: true },
    });

    if (!vinculo) throw new ForbiddenException('Professor sem vinculo com este aluno.');
  }

  private garantirUsuarioAutenticado(user?: AuthenticatedUser): asserts user is AuthenticatedUser {
    if (!user) throw new ForbiddenException('Usuario nao autenticado.');
  }

  private mapearEvento(evento: EventoLinhaTempoAluno, user?: AuthenticatedUser): LinhaTempoAlunoItem {
    if (this.deveMascararEvento(evento, user)) {
      return this.mapearEventoMascarado(evento);
    }

    return {
      id: evento.id,
      tipo: evento.tipo,
      data: evento.dataEvento.toISOString(),
      titulo: evento.titulo,
      descricao: evento.descricao || undefined,
      origem: evento.origem,
      alunoId: evento.alunoId,
      turmaId: evento.turmaId || undefined,
      turmaNome: evento.turmaNomeSnapshot || undefined,
      professorNome: evento.professorNomeSnapshot || undefined,
      usuarioNome: evento.usuarioNomeSnapshot || undefined,
      metadata: this.mapearMetadata(evento.metadata),
    };
  }

  private mapearEventoMascarado(evento: EventoLinhaTempoAluno): LinhaTempoAlunoItem {
    return {
      id: evento.id,
      tipo: evento.tipo,
      data: evento.dataEvento.toISOString(),
      titulo: this.tituloEventoSensivel(evento),
      descricao: 'Detalhes restritos a secretaria e administracao.',
      origem: evento.origem,
      alunoId: evento.alunoId,
      turmaId: evento.turmaId || undefined,
      turmaNome: evento.turmaNomeSnapshot || undefined,
      professorNome: evento.professorNomeSnapshot || undefined,
      usuarioNome: evento.usuarioNomeSnapshot || undefined,
      metadata: {
        sensivel: true,
        restrito: true,
      },
    };
  }

  private deveMascararEvento(evento: EventoLinhaTempoAluno, user?: AuthenticatedUser): boolean {
    if (user?.role !== Role.PROFESSOR) return false;
    return evento.sensivel || evento.tipo === TipoEventoLinhaTempoAluno.LAUDO || evento.tipo === TipoEventoLinhaTempoAluno.ATESTADO;
  }

  private tituloEventoSensivel(evento: EventoLinhaTempoAluno): string {
    if (evento.tipo === TipoEventoLinhaTempoAluno.LAUDO) return 'Laudo medico registrado.';
    if (evento.tipo === TipoEventoLinhaTempoAluno.ATESTADO) return 'Atestado registrado.';
    if (evento.tipo === TipoEventoLinhaTempoAluno.OBSERVACAO_MANUAL) return 'Observacao manual registrada.';
    return evento.titulo;
  }

  private mapearMetadata(metadata: Prisma.JsonValue): Record<string, unknown> | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    return metadata as Record<string, unknown>;
  }

  private periodoWhere(periodo: Periodo): Prisma.DateTimeFilter | undefined {
    if (!periodo.inicio && !periodo.fim) return undefined;
    return {
      ...(periodo.inicio && { gte: periodo.inicio }),
      ...(periodo.fim && { lte: periodo.fim }),
    };
  }

  private normalizarPeriodo(dataInicio?: string, dataFim?: string): Periodo {
    const inicio = dataInicio ? this.inicioDoDia(new Date(dataInicio)) : undefined;
    const fim = dataFim ? this.fimDoDia(new Date(dataFim)) : undefined;
    if (inicio && Number.isNaN(inicio.getTime())) throw new BadRequestException('Data inicial invalida.');
    if (fim && Number.isNaN(fim.getTime())) throw new BadRequestException('Data final invalida.');
    if (inicio && fim && inicio > fim) throw new BadRequestException('Data inicial nao pode ser maior que a data final.');
    return { inicio, fim };
  }

  private normalizarTipos(tipo?: string): TipoEventoLinhaTempoAluno[] | null {
    if (!tipo?.trim()) return null;
    const tipos = tipo
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const invalidos = tipos.filter((item) => !TIPOS_LINHA_TEMPO.includes(item as TipoEventoLinhaTempoAluno));
    if (invalidos.length) throw new BadRequestException(`Tipo de evento invalido: ${invalidos.join(', ')}.`);
    return tipos as TipoEventoLinhaTempoAluno[];
  }

  private normalizarPaginacao(pageValue?: number, limitValue?: number) {
    const page = Number.isFinite(Number(pageValue)) && Number(pageValue) > 0 ? Math.floor(Number(pageValue)) : 1;
    const limit = Number.isFinite(Number(limitValue)) && Number(limitValue) > 0 ? Math.min(100, Math.floor(Number(limitValue))) : 30;
    return { page, limit, skip: (page - 1) * limit };
  }

  private normalizarTextoObrigatorio(value: string | undefined, mensagem: string): string {
    const texto = value?.trim();
    if (!texto) throw new BadRequestException(mensagem);
    return texto;
  }

  private normalizarTextoOpcional(value?: string | null): string | undefined {
    const texto = value?.trim();
    return texto || undefined;
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
}
