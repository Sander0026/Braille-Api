import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditOptions } from './interfaces/audit-options.interface';
import { QueryAuditDto } from './dto/query-audit.dto';
import { ApiResponse } from '../common/dto/api-response.dto';

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Registra um evento de auditoria. Fire-and-forget — erros são silenciados
     * para não interromper o fluxo principal da aplicação.
     */
    async registrar(opts: AuditOptions): Promise<void> {
        // Serialização segura: descarta funções e objetos binários (ex: StreamableFile)
        const safeJson = (val: unknown): any => {
            if (val === undefined || val === null) return null;
            try { return JSON.parse(JSON.stringify(val)); } catch { return null; }
        };
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
                    oldValue: safeJson(opts.oldValue),
                    newValue: safeJson(opts.newValue),
                },
            });
        } catch (err: unknown) {
            // Falha de auditoria nunca deve derrubar a requisição
            const erroMsg = err instanceof Error ? err.message : 'Falha desconhecida';
            this.logger.warn(`Falha ao registrar evento de auditoria (RegistroId: ${opts.registroId}): ${erroMsg}`);
        }
    }

    // ─── Consultas ───────────────────────────────────────────────────────────

    /**
     * Retorna a lista completa de logs com paginação e filtros opcionais.
     */
    async findAll(query: QueryAuditDto): Promise<ApiResponse<any>> {
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

        return new ApiResponse(true, {
            data: logs,
            meta: { total, page, lastPage: Math.ceil(total / limit) },
        }, 'Logs recuperados com sucesso.');
    }

    /** 
     * Retorna o histórico de auditoria restrito de um registro específico (ex: histórico de um Aluno). 
     */
    async findByRegistro(entidade: string, registroId: string): Promise<ApiResponse<any>> {
        const logs = await this.prisma.auditLog.findMany({
            where: { entidade, registroId },
            orderBy: { criadoEm: 'desc' },
            take: 50,
        });

        return new ApiResponse(true, logs, `Histórico de ${entidade} carregado.`);
    }

    /** 
     * Estatísticas rápidas para o dashboard do painel de auditoria. 
     */
    async stats(): Promise<ApiResponse<any>> {
        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);

        const [total, hoje, porAcao] = await Promise.all([
            this.prisma.auditLog.count(),
            this.prisma.auditLog.count({
                where: { criadoEm: { gte: inicioHoje } },
            }),
            this.prisma.auditLog.groupBy({
                by: ['acao'],
                _count: { _all: true },
                orderBy: { _count: { acao: 'desc' } },
                take: 10,
            }),
        ]);

        return new ApiResponse(true, {
            totalLogs: total,
            logsHoje: hoje,
            topAcoes: porAcao.map(a => ({ acao: a.acao, total: a._count._all })),
        }, 'Estatísticas de auditoria carregadas.');
    }
}

