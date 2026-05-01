import { BadRequestException } from '@nestjs/common';
import { AuditAcao } from '@prisma/client';
import { ApoiadoresService } from './apoiadores.service';

describe('ApoiadoresService', () => {
  const apoiador = {
    id: 'apoiador-1',
    nomeRazaoSocial: 'Empresa Parceira',
    nomeFantasia: null,
    ativo: false,
    exibirNoSite: false,
  };

  const modelo = {
    id: 'modelo-1',
    textoTemplate: 'Certificado para {{NOME_DESTINATARIO}}',
  };

  const certificado = {
    id: 'cert-1',
    codigoValidacao: 'ABC123',
    dataEmissao: new Date('2026-04-29T10:00:00.000Z'),
    pdfUrl: 'https://res.cloudinary.com/demo/certificado.pdf',
    alunoId: null,
    turmaId: null,
    apoiadorId: apoiador.id,
    acaoId: null,
    motivoPersonalizado: null,
    modeloId: modelo.id,
  };

  const criarService = () => {
    const prisma = {
      apoiador: {
        findUnique: jest.fn().mockResolvedValue(apoiador),
        update: jest.fn().mockResolvedValue({ ...apoiador, ativo: true, exibirNoSite: false }),
      },
      modeloCertificado: {
        findUnique: jest.fn().mockResolvedValue(modelo),
      },
      certificadoEmitido: {
        create: jest.fn().mockResolvedValue(certificado),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const pdfService = {
      construirPdfBase: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };

    const uploadService = {
      uploadPdfBuffer: jest.fn().mockResolvedValue({ url: certificado.pdfUrl }),
    };

    const auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ApoiadoresService(
      prisma as never,
      pdfService as never,
      uploadService as never,
      auditService as never,
    );

    return { service, prisma, pdfService, uploadService, auditService };
  };

  it('reativa apoiador sem publicar automaticamente no site', async () => {
    const { service, prisma, auditService } = criarService();
    const auditUser = { sub: 'user-1', nome: 'Admin', role: 'ADMIN' };

    const result = await service.reativar(apoiador.id, auditUser as never);

    expect(result).toEqual({ ...apoiador, ativo: true, exibirNoSite: false });
    expect(prisma.apoiador.update).toHaveBeenCalledWith({
      where: { id: apoiador.id },
      data: { ativo: true, exibirNoSite: false },
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'Apoiador',
        registroId: apoiador.id,
        acao: AuditAcao.RESTAURAR,
        newValue: { ativo: true, exibirNoSite: false },
      }),
    );
  });

  it('nao cria certificado quando o upload do PDF falha', async () => {
    const { service, prisma, uploadService } = criarService();
    uploadService.uploadPdfBuffer.mockRejectedValueOnce(new Error('Cloudinary indisponivel'));

    await expect(
      service.emitirCertificado(apoiador.id, { modeloId: modelo.id }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.certificadoEmitido.create).not.toHaveBeenCalled();
  });

  it('retorna contrato leve por padrao e inclui base64 apenas quando solicitado', async () => {
    const { service } = criarService();

    const respostaLeve = await service.emitirCertificado(apoiador.id, { modeloId: modelo.id });

    expect(respostaLeve).toEqual({
      certificado,
      pdfUrl: certificado.pdfUrl,
      codigoValidacao: expect.any(String),
    });
    expect(respostaLeve.pdfBase64).toBeUndefined();

    const respostaComBase64 = await service.emitirCertificado(
      apoiador.id,
      { modeloId: modelo.id },
      undefined,
      { incluirPdfBase64: true },
    );

    expect(respostaComBase64.pdfBase64).toBe(Buffer.from('pdf').toString('base64'));
  });
});
