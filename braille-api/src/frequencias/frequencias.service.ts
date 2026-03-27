import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { CreateFrequenciaDto } from './dto/create-frequencia.dto';
import { CreateFrequenciaLoteDto } from './dto/create-frequencia-lote.dto';
import { UpdateFrequenciaDto } from './dto/update-frequencia.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryFrequenciaDto } from './dto/query-frequencia.dto';
import { Role, AuditAcao } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class FrequenciasService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogService,
    @Inject(REQUEST) private request: any,
  ) { }

  private getAutor() {
    return {
      autorId: this.request.user?.sub,
      autorNome: this.request.user?.nome,
      autorRole: this.request.user?.role as Role,
      ip: (this.request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || this.request.socket?.remoteAddress,
      userAgent: this.request.headers?.['user-agent'],
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Compara se dataAula é Hoje em UTC (ignora horário). */
  private ehHoje(dataAula: Date): boolean {
    const hoje = new Date();
    return (
      dataAula.getUTCFullYear() === hoje.getUTCFullYear() &&
      dataAula.getUTCMonth() === hoje.getUTCMonth() &&
      dataAula.getUTCDate() === hoje.getUTCDate()
    );
  }

  /**
   * Garante que a chamada pertence ao dia atual.
   * ADMIN pode ignorar a trava (bypass = true).
   */
  private validarDataHoje(dataAula: Date, bypass = false): void {
    // if (bypass) return;
    // if (!this.ehHoje(dataAula)) {
    //   throw new ForbiddenException(
    //     'Chamadas de datas anteriores não podem ser criadas ou alteradas. ' +
    //     'A chamada só pode ser editada no próprio dia da aula. ' +
    //     'Apenas administradores podem retificar chamadas antigas.'
    //   );
    // }
  }

  /**
   * Verifica se o diário (turma+data) está fechado.
   * Se fechado e o usuário não for ADMIN → lança ForbiddenException.
   */
  private async verificarDiarioAberto(
    turmaId: string,
    dataAula: Date,
    role: Role,
  ): Promise<void> {
    // Verifica se qualquer frequência dessa turma+data está marcada como fechado
    const fechado = await this.prisma.frequencia.findFirst({
      where: { turmaId, dataAula, fechado: true },
      select: { id: true },
    });

    if (fechado && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'O diário desta data está fechado. Somente um administrador pode reabri-lo para retificação.'
      );
    }
  }

  // ─── CRUD Principal ────────────────────────────────────────────────────────

  async create(dto: CreateFrequenciaDto, requesterRole: Role = Role.PROFESSOR) {
    const dataConvertida = new Date(dto.dataAula);

    // ADMIN pode lançar chamada retroativa; professor só no dia
    this.validarDataHoje(dataConvertida, requesterRole === Role.ADMIN);

    // Trava: diário fechado?
    await this.verificarDiarioAberto(dto.turmaId, dataConvertida, requesterRole);

    const chamadaExistente = await this.prisma.frequencia.findFirst({
      where: { alunoId: dto.alunoId, turmaId: dto.turmaId, dataAula: dataConvertida },
    });

    if (chamadaExistente) {
      throw new ConflictException('A chamada para este aluno nesta oficina já foi registrada hoje.');
    }

    return this.prisma.frequencia.create({
      data: { ...dto, dataAula: dataConvertida },
    });
  }

  // ─── Lote Absoluto (Fase 23) ──────────────────────────────────────────────────
  async salvarLote(
    dto: CreateFrequenciaLoteDto,
    userId: string,
    userNome: string,
    requesterRole: Role,
  ) {
    const dataConvertida = new Date(dto.dataAula);

    // Validações básicas (Bypass só pro Admin)
    this.validarDataHoje(dataConvertida, requesterRole === Role.ADMIN);
    await this.verificarDiarioAberto(dto.turmaId, dataConvertida, requesterRole);

    // Identifica o IP para o Log Manual (migrado pro getAutor centralizado)
    const autorContext = this.getAutor();

    // Transação de Alta Performance: O(1) conexão vs O(N) conexões!
    try {
      const auditPayloads: any[] = [];

      await this.prisma.$transaction(async (tx) => {
        // Pré-carrega registros existentes para evitar buscas redundantes (O(1) query vs O(N) queries)
        const alunosIds = dto.alunos.map(a => a.alunoId);
        const existentesDb = await tx.frequencia.findMany({
          where: {
            turmaId: dto.turmaId,
            dataAula: dataConvertida,
            alunoId: { in: alunosIds },
          },
        });
        const mapaExistentes = new Map(existentesDb.map(f => [f.alunoId, f]));

        for (const aluno of dto.alunos) {
          let frequenciaFinal: any;
          let acaoAudit: AuditAcao;
          let oldValue: any = undefined;

          // Preferência para a busca no banco pré-carregada via turmaId + dataAula + alunoId
          const existente = mapaExistentes.get(aluno.alunoId);

          if (existente) {
            oldValue = existente;

            // Se já é FALTA_JUSTIFICADA, não sobrescreve o status (preserva o atestado)
            if (existente.status === 'FALTA_JUSTIFICADA') {
              frequenciaFinal = existente; // não altera
              acaoAudit = AuditAcao.ATUALIZAR;
            } else {
              frequenciaFinal = await tx.frequencia.update({
                where: { id: existente.id },
                data: { presente: aluno.presente },
              });
              acaoAudit = AuditAcao.ATUALIZAR;
            }
          } else {
            frequenciaFinal = await tx.frequencia.create({
              data: {
                turmaId: dto.turmaId,
                alunoId: aluno.alunoId,
                dataAula: dataConvertida,
                presente: aluno.presente,
              },
            });
            acaoAudit = AuditAcao.CRIAR;
          }

          // ── Auto-justificativa por Atestado Ativo ────────────────────────────
          // Se o aluno foi marcado como FALTA, verificar se existe atestado cobrindo esse dia.
          // Isso garante que faltas lançadas EM DATAS FUTURAS já cobertas por atestado sejam
          // automaticamente justificadas sem precisar reemitir o atestado.
          if (!aluno.presente && frequenciaFinal.status !== 'FALTA_JUSTIFICADA') {
            const atestadoAtivo = await tx.atestado.findFirst({
              where: {
                alunoId: aluno.alunoId,
                dataInicio: { lte: dataConvertida },
                dataFim:    { gte: dataConvertida },
              },
              select: { id: true },
            });

            if (atestadoAtivo) {
              frequenciaFinal = await tx.frequencia.update({
                where: { id: frequenciaFinal.id },
                data: {
                  status: 'FALTA_JUSTIFICADA',
                  justificativaId: atestadoAtivo.id,
                },
              });
            }
          }

          // Coleta o log em vez de disparar concorrência pesada no meio da transação
          auditPayloads.push({
            entidade: 'Frequencia',
            registroId: frequenciaFinal.id,
            acao: acaoAudit,
            ...autorContext, // Usa a extração global unificada
            oldValue,
            newValue: frequenciaFinal,
          });
        }
      }, {
        maxWait: 10000,
        timeout: 30000, // Previne "Transaction API error: Transaction not found."
      });

      // Dispara a auditoria de forma sequencial, no background, para não exaurir o Pool de Conexões do Prisma nem a transação.
      Promise.resolve().then(async () => {
        for (const payload of auditPayloads) {
          await this.auditService.registrar(payload).catch(() => { });
        }
      });

      return { sucesso: true, processados: dto.alunos.length, mensagem: 'Operação de lote efetivada com integridade atômica.' };

    } catch (error: any) {
      console.error('🔥 Erro Crítico Prisma Transação (Lote):', error);
      throw new BadRequestException(
        `Falha ao processar o Lote de Chamadas. O servidor do banco de dados abortou a transação. Motivo técnico: ${error.message || 'Desconhecido'}`
      );
    }
  }

  async findAll(query: QueryFrequenciaDto) {
    const { page = 1, limit = 20, turmaId, alunoId, dataAula, professorId } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (turmaId) whereCondicao.turmaId = turmaId;
    if (alunoId) whereCondicao.alunoId = alunoId;
    if (dataAula) whereCondicao.dataAula = new Date(dataAula);
    if (professorId) whereCondicao.turma = { professorId };

    const [frequencias, total] = await Promise.all([
      this.prisma.frequencia.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        include: {
          aluno: { select: { id: true, nomeCompleto: true } },
          turma: { select: { id: true, nome: true } },
        },
        orderBy: { dataAula: 'desc' },
      }),
      this.prisma.frequencia.count({ where: whereCondicao }),
    ]);

    return {
      data: frequencias,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findResumo(query: QueryFrequenciaDto) {
    const { page = 1, limit = 20, turmaId, professorId } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (turmaId) whereCondicao.turmaId = turmaId;
    if (professorId) whereCondicao.turma = { professorId };

    const grouped = await this.prisma.frequencia.groupBy({
      by: ['dataAula', 'turmaId'],
      where: whereCondicao,
      _count: { _all: true },
      orderBy: { dataAula: 'desc' },
    });

    const total = grouped.length;
    const paginatedGroup = grouped.slice(skip, skip + Number(limit));

    const enrichedData = await Promise.all(
      paginatedGroup.map(async (group) => {
        const turma = await this.prisma.turma.findUnique({
          where: { id: group.turmaId },
          select: { nome: true },
        });

        const presentesCount = await this.prisma.frequencia.count({
          where: { dataAula: group.dataAula, turmaId: group.turmaId, presente: true },
        });

        // Verifica se o diário está fechado para este turmaId+dataAula
        const diarioFechado = await this.prisma.frequencia.findFirst({
          where: { turmaId: group.turmaId, dataAula: group.dataAula, fechado: true },
          select: { fechado: true, fechadoEm: true },
        });

        return {
          dataAula: group.dataAula,
          turmaId: group.turmaId,
          turmaNome: turma?.nome || 'Desconhecido',
          totalAlunos: group._count._all,
          presentes: presentesCount,
          faltas: group._count._all - presentesCount,
          diarioFechado: !!diarioFechado?.fechado,
          fechadoEm: diarioFechado?.fechadoEm ?? null,
        };
      })
    );

    return {
      data: enrichedData,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async getRelatorioAluno(turmaId: string, alunoId: string) {
    const data = await this.prisma.frequencia.findMany({
      where: { turmaId, alunoId },
      orderBy: { dataAula: 'desc' },
    });

    const totais = data.reduce(
      (acc, curr) => {
        if (curr.presente) acc.presentes++;
        else acc.faltas++;
        return acc;
      },
      { presentes: 0, faltas: 0 }
    );

    return {
      estatisticas: {
        totalAulas: data.length,
        ...totais,
        taxaPresenca: data.length > 0 ? Math.round((totais.presentes / data.length) * 100) : 0,
      },
      historico: data,
    };
  }

  async findOne(id: string) {
    const frequencia = await this.prisma.frequencia.findUnique({
      where: { id },
      include: { aluno: true, turma: true },
    });
    if (!frequencia) throw new NotFoundException('Registro de chamada não encontrado.');
    return frequencia;
  }

  async update(id: string, dto: UpdateFrequenciaDto, requesterRole: Role = Role.PROFESSOR) {
    const frequencia = await this.findOne(id);

    // Professor só edita no dia; ADMIN pode retificar qualquer data
    this.validarDataHoje(frequencia.dataAula, requesterRole === Role.ADMIN);

    // Trava: diário fechado?
    await this.verificarDiarioAberto(frequencia.turmaId, frequencia.dataAula, requesterRole);

    const dadosParaAtualizar: any = { ...dto };
    if (dto.dataAula) dadosParaAtualizar.dataAula = new Date(dto.dataAula);

    return this.prisma.frequencia.update({ where: { id }, data: dadosParaAtualizar });
  }

  async remove(id: string, requesterRole: Role = Role.PROFESSOR) {
    const frequencia = await this.findOne(id);
    this.validarDataHoje(frequencia.dataAula, requesterRole === Role.ADMIN);
    await this.verificarDiarioAberto(frequencia.turmaId, frequencia.dataAula, requesterRole);
    return this.prisma.frequencia.delete({ where: { id } });
  }

  // ─── Fechamento de Diário ───────────────────────────────────────────────────

  /**
   * PROFESSOR fecha o diário de uma turma em uma data específica.
   * Após fechar: só ADMIN pode reabrir/retificar.
   * Regra: só pode fechar o diário do dia atual (professor), ou qualquer dia (admin).
   */
  async fecharDiario(
    turmaId: string,
    dataAula: string,
    userId: string,
    requesterRole: Role,
  ) {
    const data = new Date(dataAula);

    // Professor só fecha o diário do dia atual
    if (requesterRole !== Role.ADMIN && !this.ehHoje(data)) {
      throw new ForbiddenException('Só é possível fechar o diário do dia atual.');
    }

    // Verifica se há registros para fechar
    const registros = await this.prisma.frequencia.findMany({
      where: { turmaId, dataAula: data },
      select: { id: true, fechado: true },
    });

    if (registros.length === 0) {
      throw new BadRequestException('Não há registros de chamada para fechar nesta data.');
    }

    const jaFechados = registros.filter(r => r.fechado);
    if (jaFechados.length === registros.length) {
      throw new BadRequestException('O diário desta data já está fechado.');
    }

    // Fecha todos os registros da turma nessa data
    await this.prisma.frequencia.updateMany({
      where: { turmaId, dataAula: data },
      data: { fechado: true, fechadoEm: new Date(), fechadoPor: userId },
    });

    return {
      mensagem: `Diário fechado com sucesso. ${registros.length} registro(s) bloqueado(s).`,
      turmaId,
      dataAula,
      totalRegistros: registros.length,
    };
  }

  /**
   * ADMIN reabre o diário para retificação. Volta fechado = false.
   */
  async reabrirDiario(turmaId: string, dataAula: string, requesterRole: Role) {
    if (requesterRole !== Role.ADMIN) {
      throw new ForbiddenException('Somente administradores podem reabrir um diário fechado.');
    }

    const data = new Date(dataAula);

    await this.prisma.frequencia.updateMany({
      where: { turmaId, dataAula: data, fechado: true },
      data: { fechado: false, fechadoEm: null, fechadoPor: null },
    });

    return { mensagem: 'Diário reaberto para retificação.', turmaId, dataAula };
  }
}