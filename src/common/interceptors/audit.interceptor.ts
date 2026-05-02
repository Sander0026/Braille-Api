import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { resolverIp } from '../helpers/audit.helper';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';

// ── Mapas de Heurística ───────────────────────────────────────────────────────

/**
 * Mapeamento de método HTTP → AuditAcao.
 * Funções puras que recebem o path e retornam a ação correspondente.
 */
const ACAO_MAP: Record<string, (path: string) => AuditAcao | null> = {
  POST: (path) => {
    if (path.includes('/alunos/')) return AuditAcao.MATRICULAR;
    if (path.includes('/diario/fechar')) return AuditAcao.FECHAR_DIARIO;
    if (path.includes('/diario/reabrir')) return AuditAcao.REABRIR_DIARIO;
    if (path.includes('/auth/login')) return AuditAcao.LOGIN;
    if (path.includes('/auth/logout')) return AuditAcao.LOGOUT;
    return AuditAcao.CRIAR;
  },
  PATCH: (path) => {
    if (path.includes('/restaurar')) return AuditAcao.RESTAURAR;
    if (path.includes('/status')) return AuditAcao.MUDAR_STATUS;
    return AuditAcao.ATUALIZAR;
  },
  PUT: () => AuditAcao.ATUALIZAR,
  DELETE: (path) => {
    if (path.includes('/alunos/')) return AuditAcao.DESMATRICULAR;
    return AuditAcao.EXCLUIR;
  },
};

/**
 * Mapeamento de segmento de rota → nome canónico da entidade auditada.
 * Centraliza o vocabulário de entidades — adicionar novos módulos aqui.
 */
const ENTIDADE_MAP: Record<string, string> = {
  turmas: 'Turma',
  frequencias: 'Frequencia',
  beneficiaries: 'Aluno',
  usuarios: 'User',
  auth: 'Auth',
  'audit-log': 'AuditLog',
  comunicados: 'Comunicado',
  contatos: 'Contato', // instrumentado manualmente no ContatosService
  // Módulos adicionados na refatoração de 2026-04
  'modelos-certificados': 'ModeloCertificado',
  certificados: 'CertificadoEmitido',
  apoiadores: 'Apoiador',
  'site-config': 'SiteConfig',
};

/**
 * Paths tecnicos sem relevancia de negocio para auditoria.
 * Controllers ja instrumentados manualmente no service devem usar @SkipAudit().
 */
const PATHS_EXCLUIDOS = ['/api-docs', '/health', '/audit-log'] as const;

// ── Campos sensíveis a remover do payload antes de persistir ──────────────────
const CAMPOS_SENSIVEIS = new Set([
  'senha',
  'password',
  'hash',
  'passwordhash',
  'senhahash',
  'token',
  'refreshtoken',
  'secret',
]);

// ── Interceptor ───────────────────────────────────────────────────────────────

/**
 * AuditInterceptor — interceptor global que registra automaticamente
 * todas as operações de mutação (POST, PATCH, PUT, DELETE) nas rotas críticas.
 *
 * Estratégia: fire-and-forget via tap(). Erros de auditoria nunca bloqueiam a resposta.
 *
 * Garantias de segurança:
 * - Campos sensíveis (senha, token, hash) removidos antes de persistir.
 * - Strings > 500 chars truncadas (evita blobs base64 nos logs).
 * - Arrays > 20 itens truncados com mensagem descritiva.
 * - Profundidade máxima de sanitização: 2 níveis.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const deveIgnorarAuditoria = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (deveIgnorarAuditoria) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;

    // Só auditar mutações (POST, PATCH, PUT, DELETE)
    const acaoFn = ACAO_MAP[method];
    if (!acaoFn) return next.handle();

    const path = req.path.toLowerCase();

    // Cláusula de guarda: paths de infra ou módulos já instrumentados
    if (PATHS_EXCLUIDOS.some((excluido) => path.startsWith(excluido))) {
      return next.handle();
    }

    const acao = acaoFn(path);
    if (!acao) return next.handle();

    // Extrai entidade a partir do path (ex: /api/turmas/... → "Turma")
    const segments = path.replace('/api/', '').split('/');
    const entidade = ENTIDADE_MAP[segments[0]] ?? segments[0];
    const registroId = this.extrairRegistroId(segments);

    // Dados do utilizador — tipados, sem @ts-ignore
    const reqAuth = req as AuthenticatedRequest;
    const user = reqAuth.user;
    const autorId = user?.sub;
    const autorNome = user?.nome ?? user?.email;
    const autorRole = user?.role;

    // Centralizado no helper — elimina duplicação de IP extraction
    const ip = resolverIp(reqAuth);
    const userAgent = req.headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          // oldValue populado por middlewares upstream via req.auditOldValue (tipado)
          const oldValue = reqAuth.auditOldValue ? sanitizePayload(reqAuth.auditOldValue) : undefined;

          const newValue = responseBody ? sanitizePayload(responseBody) : undefined;

          const resolvedId = registroId ?? (isRecordWithId(responseBody) ? responseBody.id : undefined);

          this.auditLogService.registrar({
            entidade,
            registroId: resolvedId,
            acao,
            autorId,
            autorNome,
            autorRole,
            ip,
            userAgent,
            oldValue,
            newValue,
          });
        },
        // Erros (4xx/5xx) não são auditados — a ação não foi concluída com sucesso
      }),
    );
  }

  private extrairRegistroId(segments: string[]): string | undefined {
    // /frequencias/diario/fechar/:turmaId/:data → segments[3]
    if (segments[0] === 'frequencias' && segments[1] === 'diario') {
      return segments[3];
    }
    return segments[1]?.length > 0 ? segments[1] : undefined;
  }
}

// ── Sanitização de Payload ────────────────────────────────────────────────────

/**
 * Sanitiza um payload antes de persistir no log de auditoria.
 * Remove campos sensíveis, trunca strings longas e arrays grandes (depth máx 2).
 */
function sanitizePayload(obj: unknown, depth = 0): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return {};
  if (depth > 2) return { '[truncado]': 'profundidade máxima atingida' };

  const clone: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Normaliza para lowercase para cobrir camelCase e snake_case (ex: passwordHash, password_hash)
    if (CAMPOS_SENSIVEIS.has(key.toLowerCase())) continue;
    clone[key] = sanitizeValue(value, depth);
  }

  return clone;
}

/** Sanitiza um valor individual (delega a helpers por tipo). */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return sanitizeArray(value, depth);
  if (typeof value === 'object' && value !== null) return sanitizePayload(value, depth + 1);
  return value;
}

/** Trunca strings longas (base64, tokens, SVGs). */
function sanitizeString(value: string): string {
  return value.length > 500 ? `${value.slice(0, 100)}…[truncado ${value.length} chars]` : value;
}

/** Trunca arrays grandes ou sanitiza cada elemento. */
function sanitizeArray(value: unknown[], depth: number): unknown {
  if (value.length > 20) return `[Array truncado: ${value.length} itens]`;
  return value.map((item) => (typeof item === 'object' && item !== null ? sanitizePayload(item, depth + 1) : item));
}

/** Type guard: verifica se o valor é um objeto com campo `id` (string). */
function isRecordWithId(val: unknown): val is { id: string } {
  return (
    typeof val === 'object' && val !== null && 'id' in val && typeof (val as Record<string, unknown>).id === 'string'
  );
}
