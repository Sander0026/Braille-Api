import { AuditAcao } from '@prisma/client';
import { CertificadosService } from './certificados.service';

describe('CertificadosService', () => {
  const modeloHonraria = {
    id: 'modelo-1',
    tipo: 'HONRARIA',
    textoTemplate: 'Certificado para {{PARCEIRO}} por {{MOTIVO}} em {{DATA}}.',
    arteBaseUrl: 'https://res.cloudinary.com/demo/arte.png',
    assinaturaUrl: 'https://res.cloudinary.com/demo/assinatura.png',
    assinaturaUrl2: 'https://res.cloudinary.com/demo/assinatura2.png',
    layoutConfig: null,
    nomeAssinante: 'Diretoria',
    cargoAssinante: 'Diretora',
  };

  const criarService = () => {
    const prisma = {
      modeloCertificado: {
        findUnique: jest.fn().mockResolvedValue(modeloHonraria),
        delete: jest.fn().mockResolvedValue(modeloHonraria),
      },
      certificadoEmitido: {
        create: jest.fn().mockResolvedValue({ id: 'cert-1', codigoValidacao: 'ABC123', modeloId: modeloHonraria.id }),
      },
    };

    const uploadService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const pdfService = {
      construirPdfBase: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };

    const imageProcessing = {
      removerFundoBrancoAssinatura: jest.fn(),
    };

    const auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const service = new CertificadosService(
      prisma as never,
      uploadService as never,
      pdfService as never,
      imageProcessing as never,
      auditService as never,
    );

    return { service, prisma, uploadService, pdfService, auditService };
  };

  it('emite honraria com contrato explicito de PDF e codigo de validacao', async () => {
    const { service, prisma, pdfService, auditService } = criarService();

    const result = await service.emitirHonraria(
      {
        modeloId: modeloHonraria.id,
        nomeParceiro: 'Parceiro Teste',
        motivo: 'apoio ao projeto',
        dataEmissao: '30/04/2026',
      },
      { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never,
    );

    expect(result.pdfBuffer).toEqual(Buffer.from('pdf'));
    expect(result.codigoValidacao).toMatch(/^[A-F0-9]{8}$/);
    expect(prisma.certificadoEmitido.create).toHaveBeenCalledWith({
      data: { codigoValidacao: result.codigoValidacao, modeloId: modeloHonraria.id },
    });
    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      modeloHonraria,
      'Certificado para Parceiro Teste por apoio ao projeto em 30/04/2026.',
      result.codigoValidacao,
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'CertificadoEmitido',
        registroId: 'cert-1',
        acao: AuditAcao.CRIAR,
      }),
    );
  });

  it('remove arquivos externos uma unica vez antes de excluir o modelo', async () => {
    const { service, prisma, uploadService, auditService } = criarService();

    await service.remove(modeloHonraria.id, { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never);

    expect(uploadService.deleteFile).toHaveBeenCalledTimes(3);
    expect(uploadService.deleteFile).toHaveBeenCalledWith(modeloHonraria.arteBaseUrl);
    expect(uploadService.deleteFile).toHaveBeenCalledWith(modeloHonraria.assinaturaUrl);
    expect(uploadService.deleteFile).toHaveBeenCalledWith(modeloHonraria.assinaturaUrl2);
    expect(prisma.modeloCertificado.delete).toHaveBeenCalledWith({ where: { id: modeloHonraria.id } });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'ModeloCertificado',
        registroId: modeloHonraria.id,
        acao: AuditAcao.EXCLUIR,
      }),
    );
  });

  it('emite certificado academico usando o nome completo do aluno no texto', async () => {
    const modeloAcademico = {
      ...modeloHonraria,
      id: 'modelo-academico',
      tipo: 'ACADEMICO',
      textoTemplate: 'O Instituto certifica que {{ nome_aluno }} concluiu {{ curso }}.',
    };
    const prisma = {
      turma: {
        findUnique: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          nome: 'Braille nivel 1',
          status: 'CONCLUIDA',
          cargaHoraria: 20,
          dataInicio: new Date('2026-01-01T00:00:00.000Z'),
          dataFim: new Date('2026-02-01T00:00:00.000Z'),
          modeloCertificadoId: modeloAcademico.id,
          modeloCertificado: modeloAcademico,
          matriculasOficina: [{ status: 'CONCLUIDA' }],
        }),
      },
      frequencia: {
        count: jest.fn().mockResolvedValue(0),
      },
      certificadoEmitido: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cert-acad-1', codigoValidacao: 'ABC12345' }),
      },
      aluno: {
        findUnique: jest.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', nomeCompleto: 'Agatha Abreu' }),
      },
    };
    const uploadService = {
      uploadPdfBuffer: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/demo/cert.pdf' }),
    };
    const pdfService = {
      construirPdfBase: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    const service = new CertificadosService(
      prisma as never,
      uploadService as never,
      pdfService as never,
      { removerFundoBrancoAssinatura: jest.fn() } as never,
      { registrar: jest.fn() } as never,
    );

    await service.emitirAcademico({
      turmaId: '11111111-1111-4111-8111-111111111111',
      alunoId: '22222222-2222-4222-8222-222222222222',
    });

    expect(prisma.aluno.findUnique).toHaveBeenCalledWith({
      where: { id: '22222222-2222-4222-8222-222222222222' },
      select: { id: true, nomeCompleto: true },
    });
    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      modeloAcademico,
      'O Instituto certifica que Agatha Abreu concluiu Braille nivel 1.',
      expect.stringMatching(/^[A-F0-9]{8}$/),
      'Agatha Abreu',
    );
  });
});
