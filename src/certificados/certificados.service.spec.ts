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
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue(modeloHonraria),
      },
      certificadoEmitido: {
        create: jest.fn().mockResolvedValue({ id: 'cert-1', codigoValidacao: 'ABC123', modeloId: modeloHonraria.id }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      aluno: {
        findFirst: jest.fn(),
      },
      turma: {
        findFirst: jest.fn(),
      },
      matriculaOficina: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'matricula-1' }),
        update: jest.fn(),
      },
      apoiador: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'apoiador-1',
          nomeRazaoSocial: 'Parceiro Teste',
          nomeFantasia: null,
        }),
      },
      acaoApoiador: {
        create: jest.fn().mockResolvedValue({ id: 'acao-1' }),
      },
    };

    const uploadService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      uploadPdfBuffer: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/demo/cert.pdf' }),
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

  it('rejeita layoutConfig invalido antes de criar modelo', async () => {
    const { service, prisma } = criarService();

    await expect(
      service.create({
        nome: 'Modelo invalido',
        tipo: 'ACADEMICO',
        textoTemplate: 'Certificamos que {{nome_aluno}} concluiu o curso.',
        nomeAssinante: 'Diretoria',
        cargoAssinante: 'Diretora',
        layoutConfig: '{"textoPronto":{"x":120}}',
      }),
    ).rejects.toThrow('layoutConfig.textoPronto.x deve ser um numero entre 0 e 100.');

    expect(prisma.modeloCertificado.create).not.toHaveBeenCalled();
  });

  it('rejeita elemento dinamico de layout fora dos limites percentuais', async () => {
    const { service, prisma } = criarService();

    await expect(
      service.create({
        nome: 'Modelo com elemento invalido',
        tipo: 'ACADEMICO',
        textoTemplate: 'Certificamos que {{nome_aluno}} concluiu o curso.',
        nomeAssinante: 'Diretoria',
        cargoAssinante: 'Diretora',
        layoutConfig: JSON.stringify({
          elements: [
            {
              id: 'elemento-1',
              type: 'TEXT',
              label: 'Nome do aluno',
              content: '{{ALUNO}}',
              x: 10,
              y: 120,
              width: 50,
            },
          ],
        }),
      }),
    ).rejects.toThrow('layoutConfig.elements[0].y deve ser um numero entre 0 e 100.');

    expect(prisma.modeloCertificado.create).not.toHaveBeenCalled();
  });

  it('emite honraria com contrato explicito de PDF e codigo de validacao', async () => {
    const { service, prisma, pdfService, auditService } = criarService();

    const result = await service.emitirHonraria(
      {
        modeloId: modeloHonraria.id,
        apoiadorId: 'apoiador-1',
        tituloAcao: 'Projeto de apoio',
        motivo: 'apoio ao projeto',
        dataEmissao: '2026-04-30',
      },
      { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never,
    );

    expect(result.pdfBuffer).toEqual(Buffer.from('pdf'));
    expect(result.codigoValidacao).toMatch(/^[A-F0-9]{8}$/);
    expect(prisma.certificadoEmitido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        codigoValidacao: result.codigoValidacao,
        modeloId: modeloHonraria.id,
        apoiadorId: 'apoiador-1',
        acaoId: 'acao-1',
        status: 'VALID',
        nomeImpresso: 'Parceiro Teste',
        cursoImpresso: 'Projeto de apoio',
        motivoPersonalizado: 'apoio ao projeto',
      }),
    });
    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      modeloHonraria,
      'Certificado para Parceiro Teste por apoio ao projeto em 2026-04-30.',
      result.codigoValidacao,
      'Parceiro Teste',
      expect.objectContaining({
        PARCEIRO: 'Parceiro Teste',
        CODIGO_CERTIFICADO: result.codigoValidacao,
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'CertificadoEmitido',
        registroId: 'cert-1',
        acao: AuditAcao.CRIAR,
      }),
    );
  });

  it('emite certificado academico manual com snapshot dos dados informados', async () => {
    const { service, prisma, pdfService, uploadService } = criarService();
    const modeloAcademico = {
      ...modeloHonraria,
      id: 'modelo-academico',
      tipo: 'ACADEMICO',
      textoTemplate: 'Certificamos que {{ALUNO}} concluiu {{NOME_CURSO}} com {{CARGA_HORARIA}}.',
    };
    prisma.modeloCertificado.findUnique.mockResolvedValue(modeloAcademico);
    prisma.aluno.findFirst.mockResolvedValue({
      id: 'aluno-1',
      nomeCompleto: 'Agatha Abreu',
      matricula: '20260001',
    });
    prisma.turma.findFirst.mockResolvedValue({
      id: 'turma-1',
      nome: 'Braille nivel 1',
      cargaHoraria: '40 horas',
      dataInicio: new Date('2026-01-01'),
      dataFim: new Date('2026-02-01'),
    });
    prisma.certificadoEmitido.create.mockResolvedValue({
      id: 'cert-manual-1',
      codigoValidacao: 'ABC12345',
      pdfUrl: 'https://res.cloudinary.com/demo/cert.pdf',
    });

    const result = await service.emitirManualAcademico({
      modeloId: modeloAcademico.id,
      alunoId: 'aluno-1',
      turmaId: 'turma-1',
      dataEmissao: '2026-05-07',
    });

    expect(result.certificadoId).toBe('cert-manual-1');
    expect(uploadService.uploadPdfBuffer).toHaveBeenCalledWith(Buffer.from('pdf'), expect.stringMatching(/^cert-manual-acad-/));
    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      modeloAcademico,
      expect.stringMatching(/^Certificamos que Agatha Abreu concluiu Braille nivel 1 com 40 horas\.$/),
      expect.stringMatching(/^[A-F0-9]{8}$/),
      'Agatha Abreu',
      expect.objectContaining({
        MATRICULA: '20260001',
        NOME_CURSO: 'Braille nivel 1',
        CARGA_HORARIA: '40 horas',
      }),
    );
    expect(prisma.certificadoEmitido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modeloId: modeloAcademico.id,
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        matriculaImpresso: '20260001',
        nomeImpresso: 'Agatha Abreu',
        cursoImpresso: 'Braille nivel 1',
        cargaHorariaImpresso: '40 horas',
        status: 'VALID',
      }),
    });
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

  it('cancela certificado valido e registra auditoria', async () => {
    const { service, prisma, auditService } = criarService();
    const certificado = { id: 'cert-1', codigoValidacao: 'ABC123', status: 'VALID' };
    prisma.certificadoEmitido.findUnique.mockResolvedValue(certificado);
    prisma.certificadoEmitido.update.mockResolvedValue({
      ...certificado,
      status: 'CANCELED',
      cancelReason: 'Erro nos dados',
    });

    const result = await service.cancelarCertificado(
      'cert-1',
      { motivo: 'Erro nos dados' },
      { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never,
    );

    expect(result.status).toBe('CANCELED');
    expect(prisma.certificadoEmitido.update).toHaveBeenCalledWith({
      where: { id: 'cert-1' },
      data: expect.objectContaining({
        status: 'CANCELED',
        canceledBy: 'user-1',
        cancelReason: 'Erro nos dados',
      }),
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'CertificadoEmitido',
        registroId: 'cert-1',
        acao: AuditAcao.ATUALIZAR,
      }),
    );
  });

  it('validacao publica retorna invalido para certificado cancelado', async () => {
    const { service, prisma } = criarService();
    prisma.certificadoEmitido.findUnique.mockResolvedValue({
      id: 'cert-1',
      codigoValidacao: 'ABC123',
      dataEmissao: new Date('2026-05-07T00:00:00.000Z'),
      status: 'CANCELED',
      aluno: { nomeCompleto: 'Agatha Abreu' },
      turma: { nome: 'Braille nivel 1', cargaHoraria: '40 horas' },
      modelo: { nome: 'Certificado padrao', tipo: 'ACADEMICO' },
    });

    const result = await service.validarPublico('ABC123');

    expect(result.valido).toBe(false);
    expect(result.status).toBe('CANCELED');
    expect(result.mensagem).toContain('invalido');
  });

  it('reemite certificado academico criando nova versao e marcando anterior como reemitido', async () => {
    const certificadoAnterior = {
      id: 'cert-antigo',
      codigoValidacao: 'OLD12345',
      status: 'VALID',
      version: 1,
      aluno: { id: 'aluno-1', nomeCompleto: 'Agatha Abreu' },
      turma: {
        id: 'turma-1',
        nome: 'Braille nivel 1',
        cargaHoraria: '40 horas',
        dataInicio: new Date('2026-01-01T00:00:00.000Z'),
        dataFim: new Date('2026-02-01T00:00:00.000Z'),
        modeloCertificado: {
          ...modeloHonraria,
          id: 'modelo-academico',
          tipo: 'ACADEMICO',
          textoTemplate: 'Certificamos que {{ALUNO}} concluiu {{NOME_CURSO}}. Codigo {{CODIGO_CERTIFICADO}}.',
        },
      },
      modelo: modeloHonraria,
    };
    const novoCertificado = { id: 'cert-novo', codigoValidacao: 'NEW12345', version: 2, status: 'VALID' };
    const prisma = {
      certificadoEmitido: {
        findUnique: jest.fn().mockResolvedValue(certificadoAnterior),
        update: jest.fn().mockResolvedValue({ ...certificadoAnterior, status: 'REISSUED' }),
        create: jest.fn().mockResolvedValue(novoCertificado),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const uploadService = {
      uploadPdfBuffer: jest.fn().mockResolvedValue({ url: 'https://res.cloudinary.com/demo/cert-v2.pdf' }),
    };
    const pdfService = {
      construirPdfBase: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    const auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new CertificadosService(
      prisma as never,
      uploadService as never,
      pdfService as never,
      { removerFundoBrancoAssinatura: jest.fn() } as never,
      auditService as never,
    );

    const result = await service.reemitirCertificado('cert-antigo', { sub: 'user-1', nome: 'Admin', role: 'ADMIN' } as never);

    expect(result.certificadoId).toBe('cert-novo');
    expect(prisma.certificadoEmitido.update).toHaveBeenCalledWith({
      where: { id: 'cert-antigo' },
      data: { status: 'REISSUED' },
    });
    expect(prisma.certificadoEmitido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alunoId: 'aluno-1',
        turmaId: 'turma-1',
        modeloId: 'modelo-academico',
        pdfUrl: 'https://res.cloudinary.com/demo/cert-v2.pdf',
        status: 'VALID',
        version: 2,
        previousCertificadoId: 'cert-antigo',
      }),
    });
    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      certificadoAnterior.turma.modeloCertificado,
      expect.stringMatching(/^Certificamos que Agatha Abreu concluiu Braille nivel 1\. Codigo [A-F0-9]{8}\.$/),
      expect.stringMatching(/^[A-F0-9]{8}$/),
      'Agatha Abreu',
      expect.objectContaining({ NOME_CURSO: 'Braille nivel 1' }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'CertificadoEmitido',
        registroId: 'cert-novo',
        acao: AuditAcao.CRIAR,
      }),
    );
  });

  it('emite certificado academico aceitando variaveis canonicas em minusculo', async () => {
    const modeloAcademico = {
      ...modeloHonraria,
      id: 'modelo-academico',
      tipo: 'ACADEMICO',
      textoTemplate:
        'Certificamos que {{ nome_aluno }} concluiu {{ nome_curso }} com {{ carga_horaria }}. Codigo {{ codigo_certificado }}.',
    };
    const prisma = {
      turma: {
        findUnique: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          nome: 'Braille nivel 1',
          status: 'CONCLUIDA',
          cargaHoraria: '40 horas',
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
        findUnique: jest.fn().mockResolvedValue({
          id: '22222222-2222-4222-8222-222222222222',
          nomeCompleto: 'Agatha Abreu',
        }),
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

    expect(pdfService.construirPdfBase).toHaveBeenCalledWith(
      modeloAcademico,
      expect.stringMatching(/^Certificamos que Agatha Abreu concluiu Braille nivel 1 com 40 horas\. Codigo [A-F0-9]{8}\.$/),
      expect.stringMatching(/^[A-F0-9]{8}$/),
      'Agatha Abreu',
      expect.objectContaining({
        NOME_CURSO: 'Braille nivel 1',
        CARGA_HORARIA: '40 horas',
      }),
    );
  });
});
