import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { RelatorioExportacao } from '../relatorios.service';

type PdfOptions = {
  emissorNome?: string;
  emissorPerfil?: string;
  emitidoEm?: Date;
};

const A4 = { width: 595.28, height: 841.89 };
const INSTITUICAO = {
  nome: process.env.INSTITUICAO_NOME || 'Instituto Luiz Braille do Espirito Santo',
  subtitulo: 'Relatorio institucional consolidado',
};

@Injectable()
export class RelatorioInstitucionalPdfService {
  async gerar(relatorio: RelatorioExportacao, options: PdfOptions = {}): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    const emitidoEm = options.emitidoEm ?? new Date(relatorio.emitidoEm);

    let page = pdfDoc.addPage([A4.width, A4.height]);
    let y = A4.height - margin;

    const addPage = () => {
      page = pdfDoc.addPage([A4.width, A4.height]);
      y = A4.height - margin;
      drawHeader();
    };

    const ensureSpace = (height: number) => {
      if (y - height >= margin + 28) return;
      addPage();
    };

    const drawText = (
      text: string,
      x: number,
      textY: number,
      opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
    ) => {
      page.drawText(this.normalizarTexto(text), {
        x,
        y: textY,
        size: opts.size ?? 9,
        font: opts.bold ? fontBold : font,
        color: opts.color ?? rgb(0.15, 0.18, 0.25),
      });
    };

    const drawHeader = () => {
      drawText(INSTITUICAO.nome, margin, y, { size: 12, bold: true, color: rgb(0.06, 0.1, 0.18) });
      drawText(INSTITUICAO.subtitulo, margin, y - 16, { size: 9, color: rgb(0.38, 0.44, 0.52) });
      drawText(`Emitido em: ${this.formatarDataHora(emitidoEm)}`, A4.width - margin - 170, y, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
      });
      drawText(`Emissor: ${options.emissorNome || 'Usuario autenticado'}`, A4.width - margin - 170, y - 14, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
      });
      page.drawRectangle({
        x: margin,
        y: y - 34,
        width: A4.width - margin * 2,
        height: 2,
        color: rgb(0.86, 0.69, 0),
      });
      y -= 58;
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(28);
      page.drawRectangle({
        x: margin,
        y: y - 6,
        width: A4.width - margin * 2,
        height: 22,
        color: rgb(0.96, 0.97, 0.98),
      });
      drawText(title, margin + 8, y, { size: 10, bold: true, color: rgb(0.06, 0.1, 0.18) });
      y -= 30;
    };

    const drawMetric = (label: string, value: string | number, col: number, row: number) => {
      const gap = 8;
      const width = (A4.width - margin * 2 - gap * 2) / 3;
      const x = margin + col * (width + gap);
      const metricY = y - row * 42;
      page.drawRectangle({
        x,
        y: metricY - 31,
        width,
        height: 36,
        borderColor: rgb(0.82, 0.86, 0.9),
        borderWidth: 0.7,
        color: rgb(1, 1, 1),
      });
      drawText(label, x + 8, metricY - 7, { size: 7.5, color: rgb(0.38, 0.44, 0.52) });
      drawText(String(value), x + 8, metricY - 24, { size: 13, bold: true, color: rgb(0.06, 0.1, 0.18) });
    };

    const drawMetrics = (metrics: Array<[string, string | number]>) => {
      const rows = Math.ceil(metrics.length / 3);
      ensureSpace(rows * 42 + 8);
      metrics.forEach(([label, value], index) => drawMetric(label, value, index % 3, Math.floor(index / 3)));
      y -= rows * 42 + 12;
    };

    const drawTable = (title: string, rows: string[]) => {
      drawSectionTitle(title);
      if (!rows.length) {
        drawText('Sem dados para os filtros informados.', margin, y, { color: rgb(0.38, 0.44, 0.52) });
        y -= 18;
        return;
      }

      for (const row of rows.slice(0, 24)) {
        ensureSpace(18);
        drawText(row, margin, y, { size: 8 });
        y -= 14;
      }

      if (rows.length > 24) {
        drawText(`Mais ${rows.length - 24} registro(s) disponiveis na exportacao XLSX.`, margin, y, {
          size: 8,
          color: rgb(0.38, 0.44, 0.52),
        });
        y -= 18;
      }
    };

    drawHeader();
    drawText('Relatorio Institucional', margin, y, { size: 18, bold: true, color: rgb(0.06, 0.1, 0.18) });
    y -= 24;
    drawText(this.descreverFiltros(relatorio.filtros), margin, y, { size: 8, color: rgb(0.38, 0.44, 0.52) });
    y -= 18;

    drawSectionTitle('Resumo');
    drawMetrics([
      ['Alunos total', relatorio.resumo.alunos.total],
      ['Alunos ativos', relatorio.resumo.alunos.ativos],
      ['Novos no periodo', relatorio.resumo.alunos.novosNoPeriodo],
      ['Turmas total', relatorio.resumo.turmas.total],
      ['Turmas andamento', relatorio.resumo.turmas.andamento],
      ['Turmas concluidas', relatorio.resumo.turmas.concluidas],
      ['Matriculas total', relatorio.resumo.matriculas.total],
      ['Matriculas ativas', relatorio.resumo.matriculas.ativas],
      ['Evadidas', relatorio.resumo.matriculas.evadidas],
      ['Taxa evasao', `${relatorio.resumo.indicadores.taxaEvasao}%`],
      ['Taxa conclusao', `${relatorio.resumo.indicadores.taxaConclusao}%`],
      ['Taxa permanencia', `${relatorio.resumo.indicadores.taxaPermanencia}%`],
    ]);

    drawTable(
      'Encerramentos recentes',
      relatorio.evasoes.data.map(
        (item) =>
          `${this.formatarData(item.encerradoEm || item.dataEncerramento)} | ${item.status} | ${item.aluno.nomeCompleto} | ${item.turma.nome} | ${item.motivoEncerramento ?? 'Sem motivo'}`,
      ),
    );
    drawTable(
      'Atendimentos recentes',
      relatorio.atendimentos.data.map(
        (item) =>
          `${this.formatarData(item.dataAtendimento)} | ${item.tipoRegistro} | ${item.aluno.nomeCompleto} | ${item.professor.nome}`,
      ),
    );
    drawTable(
      'Frequencias recentes',
      relatorio.frequencias.data.map(
        (item) =>
          `${this.formatarData(item.dataAula)} | ${item.status} | ${item.aluno.nomeCompleto} | ${item.turma.nome}`,
      ),
    );

    this.adicionarRodapes(pdfDoc, font, margin, emitidoEm);
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private adicionarRodapes(pdfDoc: PDFDocument, font: PDFFont, margin: number, emitidoEm: Date): void {
    const pages = pdfDoc.getPages();
    pages.forEach((page: PDFPage, index: number) => {
      page.drawText(`Pagina ${index + 1} de ${pages.length}`, {
        x: margin,
        y: 24,
        size: 8,
        font,
        color: rgb(0.38, 0.44, 0.52),
      });
      page.drawText(`Emitido em ${this.formatarDataHora(emitidoEm)}`, {
        x: margin + 92,
        y: 24,
        size: 8,
        font,
        color: rgb(0.38, 0.44, 0.52),
      });
    });
  }

  private descreverFiltros(filtros: object): string {
    const entries = Object.entries(filtros).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );
    if (!entries.length) return 'Filtros: todos os registros permitidos';
    return `Filtros: ${entries.map(([key, value]) => `${key}=${value}`).join('; ')}`;
  }

  private formatarData(value?: Date | string | null): string {
    if (!value) return 'Data nao informada';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data nao informada';
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private formatarDataHora(date: Date): string {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 210);
  }
}
