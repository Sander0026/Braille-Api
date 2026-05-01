import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { PdfService } from './pdf.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

describe('CertificadosController', () => {
  const criarController = () => {
    const certificadosService = {
      emitirHonraria: jest.fn().mockResolvedValue({
        pdfBuffer: Buffer.from('pdf'),
        codigoValidacao: 'ABC12345',
      }),
    };

    const pdfService = {};
    const controller = new CertificadosController(
      certificadosService as unknown as CertificadosService,
      pdfService as PdfService,
    );

    return { controller, certificadosService };
  };

  it('retorna honraria como StreamableFile com codigo de validacao no header', async () => {
    const { controller, certificadosService } = criarController();
    const req = {
      user: { sub: 'user-1', nome: 'Admin', role: 'ADMIN' },
      headers: {},
      socket: {},
    } as AuthenticatedRequest;
    const res = {
      set: jest.fn(),
    } as unknown as Response;

    const result = await controller.gerarHonraria(
      req,
      {
        modeloId: 'modelo-1',
        nomeParceiro: 'Parceiro Teste',
        motivo: 'apoio ao projeto',
        dataEmissao: '30/04/2026',
      },
      res,
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(certificadosService.emitirHonraria).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ sub: 'user-1', nome: 'Admin', role: 'ADMIN' }),
    );
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="honorific_braille.pdf"',
      'X-Codigo-Validacao': 'ABC12345',
    });
  });
});
