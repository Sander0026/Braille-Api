import { Role } from '@prisma/client';
import { RelatoriosAtendimentosIndividuaisController } from './relatorios-atendimentos-individuais.controller';
import { RelatoriosAtendimentosIndividuaisService } from '../services/relatorios-atendimentos-individuais.service';

describe('RelatoriosAtendimentosIndividuaisController', () => {
  it('deve responder PDF com application/pdf', async () => {
    const buffer = Buffer.from('%PDF-test');
    const service = {
      gerarPdf: jest.fn().mockResolvedValue(buffer),
    };
    const controller = new RelatoriosAtendimentosIndividuaisController(service as unknown as RelatoriosAtendimentosIndividuaisService);
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.gerarPdf(
      { dataInicio: '2026-05-01', dataFim: '2026-05-31' },
      {
        user: { sub: 'admin-1', nome: 'Admin', role: Role.ADMIN },
        headers: { 'user-agent': 'jest' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
      res as any,
    );

    expect(service.gerarPdf).toHaveBeenCalledWith(
      { dataInicio: '2026-05-01', dataFim: '2026-05-31' },
      { sub: 'admin-1', nome: 'Admin', role: Role.ADMIN },
      {
        sub: 'admin-1',
        nome: 'Admin',
        role: Role.ADMIN,
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    );
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length,
    }));
    expect(res.send).toHaveBeenCalledWith(buffer);
  });
});
