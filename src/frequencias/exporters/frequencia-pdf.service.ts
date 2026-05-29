import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export type DadosFrequenciaPdf = {
  turmaNome: string;
  professorNome?: string;
  dataAula: string;
  horarioAula?: string;
  emitidoEm: Date;
  emissorNome?: string;
  resumo: {
    totalAlunos: number;
    presentes: number;
    faltas: number;
    faltasJustificadas: number;
    diarioFechado: boolean;
  };
  alunos: {
    nome: string;
    matricula: string;
    status: 'Presente' | 'Falta' | 'Falta Justificada';
    observacao?: string;
  }[];
};

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
};

const A4 = { width: 595.28, height: 841.89 };
const INSTITUICAO = {
  nome: process.env.INSTITUICAO_NOME || 'Instituto Luiz Braille',
  subtitulo: 'Relatório de Frequência / Chamada',
};

@Injectable()
export class FrequenciaPdfService {
  async gerar(dados: DadosFrequenciaPdf): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    const contentWidth = A4.width - margin * 2;

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

    const drawText = (text: string, x: number, textY: number, opts: TextOptions = {}) => {
      const size = opts.size ?? 9;
      page.drawText(this.normalizarTexto(text), {
        x,
        y: textY,
        size,
        font: opts.bold ? fontBold : font,
        color: opts.color ?? rgb(0.15, 0.18, 0.25),
      });
    };

    const drawHeader = () => {
      drawText(INSTITUICAO.nome, margin, y, { size: 12, bold: true, color: rgb(0.06, 0.1, 0.18) });
      drawText(INSTITUICAO.subtitulo, margin, y - 16, { size: 9, color: rgb(0.38, 0.44, 0.52) });
      drawText(`Emitido em: ${this.formatarDataHora(dados.emitidoEm)}`, A4.width - margin - 170, y, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
      });
      drawText(`Emissor: ${dados.emissorNome || 'Sistema'}`, A4.width - margin - 170, y - 14, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
      });
      page.drawRectangle({
        x: margin,
        y: y - 34,
        width: contentWidth,
        height: 2,
        color: rgb(0.86, 0.69, 0), // Dourado padrão do sistema
      });
      y -= 58;
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(34);
      page.drawRectangle({
        x: margin,
        y: y - 7,
        width: contentWidth,
        height: 24,
        color: rgb(0.96, 0.97, 0.98),
      });
      drawText(title, margin + 8, y, { size: 10.5, bold: true, color: rgb(0.06, 0.1, 0.18) });
      y -= 34;
    };

    const drawMetric = (label: string, value: string | number, col: number, totalCols: number, metricY: number) => {
      const gap = 8;
      const width = (contentWidth - gap * (totalCols - 1)) / totalCols;
      const x = margin + col * (width + gap);
      page.drawRectangle({
        x,
        y: metricY - 35,
        width,
        height: 40,
        borderColor: rgb(0.82, 0.86, 0.9),
        borderWidth: 0.7,
        color: rgb(1, 1, 1),
      });
      drawText(label, x + 8, metricY - 8, { size: 7.5, color: rgb(0.38, 0.44, 0.52) });
      drawText(String(value), x + 8, metricY - 27, { size: 13, bold: true, color: rgb(0.06, 0.1, 0.18) });
    };

    // Rendering
    drawHeader();

    drawText('Detalhes da Chamada', margin, y, { size: 19, bold: true, color: rgb(0.06, 0.1, 0.18) });
    y -= 24;
    drawText(`Turma: ${dados.turmaNome}`, margin, y, { size: 11, bold: true });
    y -= 16;
    drawText(`Professor(a): ${dados.professorNome || 'Não atribuído'}`, margin, y, { size: 9 });
    y -= 14;
    drawText(`Data da Aula: ${dados.dataAula}`, margin, y, { size: 9 });
    if (dados.horarioAula) {
      y -= 14;
      drawText(`Horário: ${dados.horarioAula}`, margin, y, { size: 9 });
    }
    y -= 14;
    drawText(`Status: ${dados.resumo.diarioFechado ? 'Diário Fechado' : 'Em Aberto'}`, margin, y, { size: 9, bold: true, color: dados.resumo.diarioFechado ? rgb(0.1, 0.5, 0.2) : rgb(0.8, 0.3, 0) });
    y -= 28;

    drawSectionTitle('Resumo da Frequência');
    const startY = y;
    drawMetric('Total de Alunos', dados.resumo.totalAlunos, 0, 4, startY);
    drawMetric('Presentes', dados.resumo.presentes, 1, 4, startY);
    drawMetric('Faltas', dados.resumo.faltas, 2, 4, startY);
    drawMetric('Faltas Just.', dados.resumo.faltasJustificadas, 3, 4, startY);
    y -= 52;

    drawSectionTitle('Lista de Alunos');

    // Headers da Tabela
    ensureSpace(20);
    drawText('Matrícula', margin + 4, y, { size: 8, bold: true });
    drawText('Nome do Aluno', margin + 80, y, { size: 8, bold: true });
    drawText('Status', margin + 350, y, { size: 8, bold: true });
    drawText('Observação', margin + 420, y, { size: 8, bold: true });
    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 12;

    // Linhas da Tabela
    for (const aluno of dados.alunos) {
      ensureSpace(20);
      drawText(aluno.matricula || '---', margin + 4, y, { size: 8, color: rgb(0.4, 0.4, 0.4) });
      drawText(this.limitarTexto(aluno.nome, 50), margin + 80, y, { size: 8, bold: true });
      
      let statusColor = rgb(0.15, 0.18, 0.25);
      if (aluno.status === 'Presente') statusColor = rgb(0.1, 0.6, 0.2);
      if (aluno.status === 'Falta') statusColor = rgb(0.8, 0.2, 0.2);
      if (aluno.status === 'Falta Justificada') statusColor = rgb(0.8, 0.5, 0.1);
      
      drawText(aluno.status, margin + 350, y, { size: 8, bold: true, color: statusColor });
      
      drawText(this.limitarTexto(aluno.observacao || '---', 30), margin + 420, y, { size: 8, color: rgb(0.5, 0.5, 0.5) });
      
      y -= 10;
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      y -= 10;
    }

    if (dados.alunos.length === 0) {
      drawText('Nenhum aluno registrado para esta chamada.', margin + 4, y, { size: 9, color: rgb(0.5, 0.5, 0.5) });
    }

    this.adicionarRodapes(pdfDoc, font, margin, dados.emitidoEm);
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private adicionarRodapes(pdfDoc: PDFDocument, font: PDFFont, margin: number, emitidoEm: Date): void {
    const pages = pdfDoc.getPages();
    pages.forEach((page: PDFPage, index: number) => {
      page.drawText(`Página ${index + 1} de ${pages.length}`, {
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

  private formatarDataHora(date: Date): string {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private limitarTexto(texto: string, limite: number): string {
    const normalized = this.normalizarTexto(texto);
    if (normalized.length <= limite) return normalized;
    return `${normalized.slice(0, limite - 3).trim()}...`;
  }

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
