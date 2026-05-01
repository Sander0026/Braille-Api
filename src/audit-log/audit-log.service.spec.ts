import { AuditLogService } from './audit-log.service';

describe('AuditLogService.serializarSeguro', () => {
  it('deve preservar campos validos e normalizar valores especiais sem descartar o snapshot inteiro', () => {
    const circular: Record<string, unknown> = {
      id: 'registro-1',
      criadoEm: new Date('2026-04-29T10:00:00.000Z'),
      contador: BigInt(10),
      executar: () => undefined,
      arquivo: new Uint8Array([1, 2, 3]),
    };
    circular.self = circular;

    const resultado = AuditLogService.serializarSeguro(circular) as Record<string, unknown>;

    expect(resultado).toEqual({
      id: 'registro-1',
      criadoEm: '2026-04-29T10:00:00.000Z',
      contador: '10',
      executar: '[nao serializavel]',
      arquivo: '[binario 3 bytes]',
      self: '[referencia circular]',
    });
  });

  it('deve retornar undefined apenas para valor ausente na raiz', () => {
    expect(AuditLogService.serializarSeguro(undefined)).toBeUndefined();
    expect(AuditLogService.serializarSeguro(null)).toBeUndefined();
  });
});
