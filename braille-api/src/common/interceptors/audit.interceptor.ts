import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Mapeamento de método HTTP + rota → AuditAcao.
 * O interceptor usa heurísticas baseadas no método e no path para decidir a ação.
 */
const ACAO_MAP: Record<string, (path: string) => AuditAcao | null> = {
    POST: (path: string) => {
        if (path.includes('/alunos/')) return AuditAcao.MATRICULAR;
        if (path.includes('/diario/fechar')) return AuditAcao.FECHAR_DIARIO;
        if (path.includes('/diario/reabrir')) return AuditAcao.REABRIR_DIARIO;
        if (path.includes('/auth/login')) return AuditAcao.LOGIN;
        return AuditAcao.CRIAR;
    },
    PATCH: (path: string) => {
        if (path.includes('/restaurar')) return AuditAcao.RESTAURAR;
        if (path.includes('/status')) return AuditAcao.MUDAR_STATUS;
        return AuditAcao.ATUALIZAR;
    },
    PUT: () => AuditAcao.ATUALIZAR,
    DELETE: (path: string) => {
        if (path.includes('/alunos/')) return AuditAcao.DESMATRICULAR;
        return AuditAcao.EXCLUIR;
    },
};

/** Entidades auditadas: extrai o nome a partir do primeiro segmento da rota após /api/ */
const ENTIDADE_MAP: Record<string, string> = {
    'turmas': 'Turma',
    'frequencias': 'Frequencia',
    'beneficiaries': 'Aluno',
    'usuarios': 'User',
    'auth': 'Auth',
    'audit-log': 'AuditLog',
    'comunicados': 'Comunicado',
};

/**
 * AuditInterceptor — interceptor global que registra automaticamente
 * todas as operações de mutação (POST, PATCH, PUT, DELETE) nas rotas críticas.
 *
 * Estratégia: fire-and-forget via tap(). Erros de auditoria nunca bloqueiam a resposta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(private readonly auditLogService: AuditLogService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest<Request>();
        const method = req.method;

        // Só auditar mutações
        const acaoFn = ACAO_MAP[method];
        if (!acaoFn) return next.handle();

        const path = req.path.toLowerCase();

        // Ignorar rotas de saúde / swagger / a própria rota de auditoria (evita recursão)
        // Ignorar também entidades que já foram completamente instrumentadas manualmente via Service (evita log duplicado)!
        if (
            path.startsWith('/api-docs') ||
            path === '/health' ||
            path.includes('/audit-log') ||
            path.includes('/frequencias') ||
            path.includes('/turmas') ||
            path.includes('/beneficiaries') || // Controller name is 'beneficiaries'
            path.includes('/users') ||         // Controller name is 'users'
            path.includes('/comunicados') ||
            path.includes('/site-config')
        ) return next.handle();


        const acao = acaoFn(path);
        if (!acao) return next.handle();

        // Extrai entidade a partir do path (ex: /api/turmas/... → "Turma")
        const segments = path.replace('/api/', '').split('/');
        const entidade = ENTIDADE_MAP[segments[0]] ?? segments[0];

        // ID do registro: segundo ou terceiro segmento dependendo da rota
        const registroId = this.extrairRegistroId(segments);

        // Extrai dados do usuário autenticado (populado pelo AuthGuard)
        const reqAuth = req as AuthenticatedRequest;
        const user = reqAuth.user;
        const autorId = user?.sub ?? undefined;
        // @ts-ignore - 'nome' e 'email' podem estar contidos no Payload JWT mas escapam da tipagem restrita padrão
        const autorNome = user?.nome ?? user?.email ?? undefined;
        const autorRole = user?.role ?? undefined;

        // IP e User-Agent
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress
            ?? undefined;
        const userAgent = req.headers['user-agent'] ?? undefined;

        return next.handle().pipe(
            tap({
                next: (responseBody: any) => {
                    // newValue = resposta do endpoint (o objeto criado/atualizado)
                    // Limitar tamanho para não estourar o banco com payloads enormes
                    const newValue = responseBody ? this.sanitize(responseBody) : undefined;

                    this.auditLogService.registrar({
                        entidade,
                        registroId: registroId ?? responseBody?.id ?? undefined,
                        acao,
                        autorId,
                        autorNome,
                        autorRole,
                        ip,
                        userAgent,
                        oldValue: (req as any).auditOldValue ? this.sanitize((req as any).auditOldValue) : undefined,
                        newValue,
                    });
                },
                // Em caso de erro (4xx/5xx), não registra — a ação não foi concluída
            })
        );
    }

    private extrairRegistroId(segments: string[]): string | undefined {
        // /turmas/:id → segments[1]
        // /turmas/:id/alunos/:alunoId → segments[1]
        // /frequencias/diario/fechar/:turmaId/:data → segments[3]
        if (segments[0] === 'frequencias' && segments[1] === 'diario') {
            return segments[3]; // turmaId
        }
        return segments[1] && segments[1].length > 0 ? segments[1] : undefined;
    }

    /** Remove campos sensíveis e trunca o objeto para evitar payloads gigantes. */
    private sanitize(obj: any): object {
        if (typeof obj !== 'object' || obj === null) return {};
        const clone = { ...obj };
        delete clone.senha;
        delete clone.password;
        delete clone.hash;
        // Trunca arrays grandes (ex: lista de alunos em uma resposta de turma)
        for (const key of Object.keys(clone)) {
            if (Array.isArray(clone[key]) && clone[key].length > 20) {
                clone[key] = `[Array truncado: ${clone[key].length} itens]`;
            }
        }
        return clone;
    }
}
