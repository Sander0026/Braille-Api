import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAcao } from '@prisma/client';

export interface AuditOptions {
    entidade: string;
    registroId?: string;
    acao: AuditAcao;
    autorId?: string;
    autorNome?: string;
    autorRole?: string;
    ip?: string;
    userAgent?: string;
    oldValue?: object;
    newValue?: object;
}

export interface QueryAuditDto {
    page?: number;
    limit?: number;
    entidade?: string;
    registroId?: string;
    autorId?: string;
    acao?: AuditAcao;
    de?: string;   // ISO date start
    ate?: string;  // ISO date end
}

@Injectable()
export class AuditLogService {
    constructor(private prisma: PrismaService) { }

    /**
     * Registra um evento de auditoria. Fire-and-forget — erros são silenciados
     * para não interromper o fluxo principal da aplicação.
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
                    oldValue: opts.oldValue as any,
                    newValue: opts.newValue as any,
                },
            });
        } catch (err) {
            // Falha de auditoria nunca deve derrubar a requisição
            console.warn('[AuditLog] Falha ao registrar evento:', err);
        }
    }

    // ─── Consultas ───────────────────────────────────────────────────────────

    async findAll(query: QueryAuditDto) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const { entidade, registroId, autorId, acao, de, ate } = query;
        const skip = (page - 1) * limit;


        const where: any = {};
        if (entidade) where.entidade = entidade;
        if (registroId) where.registroId = registroId;
        if (autorId) where.autorId = autorId;
        if (acao) where.acao = acao;
        if (de || ate) {
            where.criadoEm = {};
            if (de) where.criadoEm.gte = new Date(de);
            if (ate) where.criadoEm.lte = new Date(ate);
        }

        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { criadoEm: 'desc' },
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            data: logs,
            meta: { total, page, lastPage: Math.ceil(total / limit) },
        };
    }

    /** Retorna os logs de um registro específico (ex: histórico de um Aluno). */
    async findByRegistro(entidade: string, registroId: string) {
        return this.prisma.auditLog.findMany({
            where: { entidade, registroId },
            orderBy: { criadoEm: 'desc' },
            take: 50,
        });
    }

    /** Estatísticas rápidas para o dashboard do painel de auditoria. */
    async stats() {
        const [total, hoje, porAcao] = await Promise.all([
            this.prisma.auditLog.count(),
            this.prisma.auditLog.count({
                where: { criadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
            }),
            this.prisma.auditLog.groupBy({
                by: ['acao'],
                _count: { _all: true },
                orderBy: { _count: { acao: 'desc' } },
                take: 10,
            }),
        ]);

        return {
            totalLogs: total,
            logsHoje: hoje,
            topAcoes: porAcao.map(a => ({ acao: a.acao, total: a._count._all })),
        };
    }
}
