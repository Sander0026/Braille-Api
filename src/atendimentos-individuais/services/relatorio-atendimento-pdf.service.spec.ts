import { RelatorioAtendimentoPdfService } from './relatorio-atendimento-pdf.service';
import { PDFDocument } from 'pdf-lib';

function makeRelatorio(overrides: Record<string, unknown> = {}) {
  return {
    filtros: {},
    totalAcompanhamentos: 1,
    totalRegistros: 1,
    totais: {
      atendimentosRealizados: 1,
      faltasJustificadas: 0,
      faltasNaoJustificadas: 0,
      cancelados: 0,
    },
    acompanhamentos: [
      {
        id: 'acomp-1',
        assuntoAtual: 'Braille avancado',
        status: 'EM_ANDAMENTO',
        dataInicio: '2026-01-15',
        dataFinalizacao: null,
        resultadoFinal: null,
        resumoFinal: null,
        aluno: { nomeCompleto: 'Aluno PDF', matricula: '202600010' },
        professor: { nome: 'Professor PDF', matricula: 'P010' },
        atendimentos: [
          {
            id: 'atend-1',
            dataAtendimento: '2026-05-08',
            tipoRegistro: 'ATENDIMENTO_REALIZADO',
            horaInicio: '08:00',
            horaFim: '09:30',
            duracaoMinutos: 90,
            modalidade: 'PRESENCIAL',
            localAtendimento: 'Sala 3',
            assuntoDoDia: 'Leitura avancada',
            observacao: 'Aluno progrediu bem.',
            evolucao: null,
            dificuldades: null,
            pendencias: null,
            recomendacoes: null,
            arquivos: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('RelatorioAtendimentoPdfService', () => {
  let service: RelatorioAtendimentoPdfService;

  beforeEach(() => {
    service = new RelatorioAtendimentoPdfService();
  });

  // ─── 1. PDF retorna buffer válido com header %PDF ──────────────────

  it('deve gerar buffer PDF valido com assinatura %PDF', async () => {
    const relatorio = makeRelatorio();
    const buffer = await service.gerar(relatorio);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const header = buffer.subarray(0, 4).toString('utf8');
    expect(header).toBe('%PDF');
  });

  // ─── 2. PDF contém páginas válidas e o formatador de detalhes funciona ──

  it('deve gerar PDF com pelo menos 1 pagina contendo os dados do relatorio', async () => {
    const relatorio = makeRelatorio();
    const buffer = await service.gerar(relatorio);

    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('descreverDetalhesAtendimento deve formatar horario, modalidade e local', () => {
    // Acessa o método privado via indexação para teste unitário
    const detalhes = (service as any).descreverDetalhesAtendimento({
      horaInicio: '08:00',
      horaFim: '09:30',
      duracaoMinutos: 90,
      modalidade: 'PRESENCIAL',
      localAtendimento: 'Sala 3',
    });

    expect(detalhes).toContain('Inicio 08:00');
    expect(detalhes).toContain('Fim 09:30');
    expect(detalhes).toContain('90 min');
    expect(detalhes).toContain('Modalidade Presencial');
    expect(detalhes).toContain('Local Sala 3');
  });

  it('descreverFiltros deve incluir periodo, status e tipo aplicados', () => {
    const filtros = (service as any).descreverFiltros({
      alunoId: 'aluno-1',
      professorId: 'prof-1',
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
      status: 'EM_ANDAMENTO',
      tipoRegistro: 'ATENDIMENTO_REALIZADO',
    });

    expect(filtros).toContain('Aluno selecionado');
    expect(filtros).toContain('Professor selecionado');
    expect(filtros).toContain('Periodo 2026-05-01 a 2026-05-31');
    expect(filtros).toContain('Status Em Andamento');
    expect(filtros).toContain('Tipo Atendimento realizado');
  });
});
