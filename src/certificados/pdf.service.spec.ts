import { PdfService, ModeloPdf } from './pdf.service';

describe('PdfService', () => {
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lz2dTQAAAABJRU5ErkJggg==',
    'base64',
  );

  const criarService = () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://front.test';
        return undefined;
      }),
    };

    return new PdfService(configService as never);
  };

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () =>
        pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength),
      headers: { get: () => 'image/png' },
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renderiza layout dinamico quando elements esta presente', async () => {
    const service = criarService();
    const dynamicSpy = jest.spyOn(service as never, 'desenharElementosDinamicos');
    const modelo: ModeloPdf = {
      arteBaseUrl: 'https://res.cloudinary.com/demo/arte.png',
      assinaturaUrl: '',
      assinaturaUrl2: null,
      nomeAssinante: 'Diretoria',
      cargoAssinante: 'Diretora',
      layoutConfig: {
        elements: [
          {
            id: 'texto-1',
            type: 'DYNAMIC_TEXT',
            label: 'Curso',
            content: 'Curso {{NOME_CURSO}} - {{TEXTO_CERTIFICADO}}',
            x: 10,
            y: 20,
            width: 80,
            height: 20,
            fontSize: 16,
            zIndex: 1,
          },
          {
            id: 'codigo-1',
            type: 'VALIDATION_CODE',
            label: 'Codigo',
            content: '{{CODIGO_CERTIFICADO}}',
            x: 70,
            y: 90,
            width: 20,
            height: 5,
            fontSize: 10,
            zIndex: 2,
          },
        ],
      },
    };

    const pdf = await service.construirPdfBase(
      modelo,
      'Texto principal renderizado',
      'ABC12345',
      'Aluno Teste',
      { NOME_CURSO: 'Braille nivel 1' },
    );

    expect(pdf.length).toBeGreaterThan(0);
    expect(dynamicSpy).toHaveBeenCalledTimes(1);
  });
});
