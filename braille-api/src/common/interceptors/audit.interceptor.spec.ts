import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAcao } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditInterceptor } from './audit.interceptor';

describe('AuditInterceptor', () => {
  const criarContexto = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
    }) as unknown as ExecutionContext;

  const criarNext = (body: unknown): CallHandler => ({
    handle: jest.fn(() => of(body)),
  });

  it('deve ignorar controller ou rota marcada com SkipAudit', async () => {
    const auditLogService = { registrar: jest.fn() } as unknown as AuditLogService;
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const interceptor = new AuditInterceptor(auditLogService, reflector);

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({ method: 'POST', path: '/alunos/123/laudos', headers: {}, socket: {} }),
        criarNext({ id: 'laudo-1' }),
      ),
    );

    expect(auditLogService.registrar).not.toHaveBeenCalled();
  });

  it('deve registrar mutacao quando a rota nao esta marcada para ignorar auditoria automatica', async () => {
    const auditLogService = { registrar: jest.fn() } as unknown as AuditLogService;
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const interceptor = new AuditInterceptor(auditLogService, reflector);

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'user-agent': 'jest' },
          socket: { remoteAddress: '127.0.0.1' },
          user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
        }),
        criarNext({ id: 'login-1' }),
      ),
    );

    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Auth',
        acao: AuditAcao.LOGIN,
        autorId: 'user-1',
        autorNome: 'Admin',
        autorRole: 'ADMIN',
      }),
    );
  });

  it('deve classificar logout como acao LOGOUT na auditoria automatica', async () => {
    const auditLogService = { registrar: jest.fn() } as unknown as AuditLogService;
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const interceptor = new AuditInterceptor(auditLogService, reflector);

    await lastValueFrom(
      interceptor.intercept(
        criarContexto({
          method: 'POST',
          path: '/api/auth/logout',
          headers: {},
          socket: {},
          user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
        }),
        criarNext({ success: true }),
      ),
    );

    expect(auditLogService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Auth',
        acao: AuditAcao.LOGOUT,
        autorId: 'user-1',
      }),
    );
  });
});
