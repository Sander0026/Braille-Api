import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditOptions } from './interfaces/audit-options.interface';
import { QueryAuditDto } from './dto/query-audit.dto';
import { ApiResponse } from '../common/dto/api-response.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Registro ────────────────────────────────────────────────────────────────

  /**
   * Registra um evento de auditoria. Fire-and-forget — erros são silenciados
   * para nunca interromper o fluxo principal da aplicação.
   *
   * `serializarSeguro` é estático e definido fora do método — não é recriado
   * em cada chamada (performance: evita closure allocation por request).
   */
  async registrar(opts: AuditOptions): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entidade: opts.entidade,
          registroId: opts.registroId,
          acao: opts.acao,
          autorId: opts.autorId,
          autorNome: opts.autorNome,
          autorRole: opts.autorRole,
          ip: opts.ip,
          userAgent: opts.userAgent,
          oldValue: AuditLogService.serializarSeguro(opts.oldValue) ?? undefined,
          newValue: AuditLogService.serializarSeguro(opts.newValue) ?? undefined,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      this.logger.warn(`Falha ao registrar auditoria [${opts.entidade}/${opts.acao}]: ${msg}`);
    }
  }

  // ── Consultas ────────────────────────────────────────────────────────────────

  /**
   * Lista logs com paginação e filtros opcionais.
   * `where` tipado como Prisma.AuditLogWhereInput — type-safe, sem `any`.
   */
  async findAll(query: QueryAuditDto): Promise<ApiResponse<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entidade && { entidade: query.entidade }),
      ...(query.registroId && { registroId: query.registroId }),
      ...(query.autorId && { autorId: query.autorId }),
      ...(query.acao && { acao: query.acao }),
      ...((query.de || query.ate) && {
        criadoEm: {
          ...(query.de && { gte: new Date(query.de) }),
          ...(query.ate && { lte: new Date(query.ate) }),
        },
      }),
    };

    // Promise.all paralelo — findMany + count em simultâneo
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return new ApiResponse(
      true,
      {
        data: logs,
        meta: { total, page, lastPage: Math.ceil(total / limit) },
      },
      'Logs recuperados com sucesso.',
    );
  }

  /** Retorna o histórico de auditoria de um registro específico (máx. 50 entradas). */
  async findByRegistro(entidade: string, registroId: string): Promise<ApiResponse<unknown>> {
    const logs = await this.prisma.auditLog.findMany({
      where: { entidade, registroId },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });

    return new ApiResponse(true, logs, `Histórico de ${entidade} carregado.`);
  }

  /**
   * Estatísticas rápidas para o dashboard do painel de auditoria.
   *
   * Midnight calculado em Brasília (America/Sao_Paulo) — evita o bug de fuso
   * onde setHours(0,0,0,0) em servidor UTC contava 3h a menos por dia.
   */
  async stats(): Promise<ApiResponse<unknown>> {
    const inicioHoje = AuditLogService.midnightBrasilia();

    const [total, hoje, porAcao] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { criadoEm: { gte: inicioHoje } } }),
      this.prisma.auditLog.groupBy({
        by: ['acao'],
        _count: { _all: true },
        orderBy: { _count: { acao: 'desc' } },
        take: 10,
      }),
    ]);

    return new ApiResponse(
      true,
      {
        totalLogs: total,
        logsHoje: hoje,
        topAcoes: porAcao.map((a) => ({ acao: a.acao, total: a._count._all })),
      },
      'Estatísticas de auditoria carregadas.',
    );
  }

  // ── Helpers Estáticos ───────────────────────────────────────────────────────

  /**
   * Serializa um valor de forma segura para armazenamento em JSON no banco.
   * Preserva o snapshot possivel e marca valores problemáticos de forma descritiva.
   *
   * Estático e puro — definido fora de métodos de instância para evitar
   * recriação de closure em cada chamada a registrar().
   */
  static serializarSeguro(val: unknown): Prisma.InputJsonValue | undefined {
    if (val === undefined || val === null) return undefined;
    const normalizado = AuditLogService.normalizarParaJson(val, new WeakSet<object>());
    return normalizado === undefined ? undefined : (normalizado as Prisma.InputJsonValue);
  }

  private static normalizarParaJson(valor: unknown, visitados: WeakSet<object>): unknown {
    if (valor === undefined) return undefined;
    if (valor === null) return null;

    if (typeof valor === 'string' || typeof valor === 'boolean') return valor;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : String(valor);
    if (typeof valor === 'bigint') return valor.toString();
    if (typeof valor === 'function' || typeof valor === 'symbol') return '[nao serializavel]';

    if (valor instanceof Date) return valor.toISOString();
    if (ArrayBuffer.isView(valor)) return `[binario ${(valor as ArrayBufferView).byteLength} bytes]`;

    if (Array.isArray(valor)) {
      return valor.map((item) => AuditLogService.normalizarParaJson(item, visitados) ?? null);
    }

    if (typeof valor === 'object') {
      if (visitados.has(valor)) return '[referencia circular]';
      visitados.add(valor);

      const objeto: Record<string, unknown> = {};
      for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
        const normalizado = AuditLogService.normalizarParaJson(conteudo, visitados);
        if (normalizado !== undefined) objeto[chave] = normalizado;
      }

      visitados.delete(valor);
      return objeto;
    }

    return String(valor);
  }

  /**
   * Calcula o início do dia de hoje no fuso horário de Brasília (America/Sao_Paulo).
   * Corrige o bug de `setHours(0,0,0,0)` que usava o fuso local do servidor (UTC em produção).
   */
  private static midnightBrasilia(): Date {
    // 'en-CA' retorna YYYY-MM-DD — formato ISO sem necessitar de parse extra
    const dataBR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return new Date(`${dataBR}T00:00:00-03:00`);
  }
}
