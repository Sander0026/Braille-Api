import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { StatusFrequencia } from '@prisma/client';

export type TurmaPdfAluno = {
  nome: string;
  matricula: string;
  statusMatricula: string;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  frequenciaPercentual: number;
};

export type TurmaPdfDetalhe = {
  nome: string;
  professor: string;
  status: string;
  periodo: string;
  horario: string;
  diasDaSemana: string;
  cargaHoraria: string;
  totalAlunos: number;
  alunos: TurmaPdfAluno[];
};

export type RelatorioTurmasPdfData = {
  emitidoEm: Date;
  filtrosDescricao: string;
  emissorNome: string;
  resumo: {
    totalTurmas: number;
    ativas: number;
    concluidas: number;
    arquivadas: number;
    totalAlunosMatriculados: number;
    totalPresencas: number;
    totalFaltas: number;
  };
  turmas: TurmaPdfDetalhe[];
};

const A4 = { width: 595.28, height: 841.89 };
const INSTITUICAO = {
  nome: process.env.INSTITUICAO_NOME || 'Instituto Luiz Braille',
  subtitulo: 'Relatório de Turmas e Frequência dos Alunos',
};

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  align?: 'left' | 'center' | 'right';
};

@Injectable()
export class RelatorioTurmasPdfService {
  async gerar(data: RelatorioTurmasPdfData): Promise<Buffer> {
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
      const pdfFont = opts.bold ? fontBold : font;
      const textWidth = pdfFont.widthOfTextAtSize(this.normalizarTexto(text), size);
      
      let finalX = x;
      if (opts.align === 'center') {
        finalX = x - textWidth / 2;
      } else if (opts.align === 'right') {
        finalX = x - textWidth;
      }

      page.drawText(this.normalizarTexto(text), {
        x: finalX,
        y: textY,
        size,
        font: pdfFont,
        color: opts.color ?? rgb(0.15, 0.18, 0.25),
      });
    };

    const drawHeader = () => {
      drawText(INSTITUICAO.nome, margin, y, { size: 12, bold: true, color: rgb(0.06, 0.1, 0.18) });
      drawText(INSTITUICAO.subtitulo, margin, y - 16, { size: 9, color: rgb(0.38, 0.44, 0.52) });
      drawText(`Emitido em: ${this.formatarDataHora(data.emitidoEm)}`, A4.width - margin, y, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
        align: 'right'
      });
      drawText(`Emissor: ${data.emissorNome}`, A4.width - margin, y - 14, {
        size: 8,
        color: rgb(0.38, 0.44, 0.52),
        align: 'right'
      });
      page.drawRectangle({
        x: margin,
        y: y - 34,
        width: contentWidth,
        height: 2,
        color: rgb(0.86, 0.69, 0),
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

    const drawMetric = (label: string, value: string | number, col: number, row: number, colsCount: number = 3) => {
      const gap = 8;
      const width = (contentWidth - gap * (colsCount - 1)) / colsCount;
      const x = margin + col * (width + gap);
      const metricY = y - row * 46;
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

    // Capa / Resumo
    drawHeader();
    drawText('Relatório de Turmas', margin, y, { size: 19, bold: true, color: rgb(0.06, 0.1, 0.18) });
    y -= 24;
    drawText('Relação de turmas/oficinas, alunos matriculados, presenças e faltas', margin, y, { size: 9, color: rgb(0.38, 0.44, 0.52) });
    y -= 16;
    drawText(data.filtrosDescricao, margin, y, { size: 8, color: rgb(0.38, 0.44, 0.52) });
    y -= 28;

    drawSectionTitle('Resumo geral');
    
    // row 1
    drawMetric('Total de turmas', data.resumo.totalTurmas, 0, 0, 4);
    drawMetric('Turmas ativas', data.resumo.ativas, 1, 0, 4);
    drawMetric('Turmas concluídas', data.resumo.concluidas, 2, 0, 4);
    drawMetric('Turmas arquivadas', data.resumo.arquivadas, 3, 0, 4);
    
    // row 2
    drawMetric('Alunos matriculados', data.resumo.totalAlunosMatriculados, 0, 1, 3);
    drawMetric('Total de presenças', data.resumo.totalPresencas, 1, 1, 3);
    drawMetric('Total de faltas', data.resumo.totalFaltas, 2, 1, 3);
    
    y -= (2 * 46) + 16;

    // Turmas
    for (const turma of data.turmas) {
      ensureSpace(120);
      drawSectionTitle(`Turma: ${this.limitarTexto(turma.nome, 60)}`);
      
      const detailsX1 = margin;
      const detailsX2 = margin + contentWidth / 2;
      
      drawText(`Professor: ${turma.professor}`, detailsX1, y, { size: 8.5, bold: true });
      drawText(`Status: ${turma.status}`, detailsX2, y, { size: 8.5 });
      y -= 14;
      
      drawText(`Período: ${turma.periodo}`, detailsX1, y, { size: 8.5 });
      drawText(`Dias de aula: ${turma.diasDaSemana}`, detailsX2, y, { size: 8.5 });
      y -= 14;

      drawText(`Horário: ${turma.horario}`, detailsX1, y, { size: 8.5 });
      drawText(`Carga horária: ${turma.cargaHoraria}`, detailsX2, y, { size: 8.5 });
      y -= 14;

      drawText(`Total de alunos: ${turma.totalAlunos}`, detailsX1, y, { size: 8.5 });
      y -= 24;

      // Tabela de Alunos
      if (turma.alunos.length === 0) {
        drawText('Nenhum aluno matriculado nesta turma.', margin, y, { size: 9, color: rgb(0.38, 0.44, 0.52) });
        y -= 24;
      } else {
        const colWidths = [180, 70, 50, 50, 60, 60];
        const headers = ['Aluno', 'Matrícula', 'Presenças', 'Faltas', 'Justificadas', 'Frequência'];
        const colX = [
          margin, 
          margin + colWidths[0], 
          margin + colWidths[0] + colWidths[1],
          margin + colWidths[0] + colWidths[1] + colWidths[2],
          margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
        ];

        // Header
        page.drawRectangle({
          x: margin,
          y: y - 5,
          width: contentWidth,
          height: 16,
          color: rgb(0.96, 0.97, 0.98),
        });
        
        for(let i=0; i<headers.length; i++) {
          drawText(headers[i], colX[i] + 4, y, { size: 8, bold: true });
        }
        y -= 16;

        for (const aluno of turma.alunos) {
          ensureSpace(20);
          page.drawLine({
            start: { x: margin, y: y + 10 },
            end: { x: margin + contentWidth, y: y + 10 },
            thickness: 0.5,
            color: rgb(0.9, 0.92, 0.95),
          });
          
          drawText(this.limitarTexto(aluno.nome, 35), colX[0] + 4, y, { size: 8 });
          drawText(aluno.matricula, colX[1] + 4, y, { size: 8 });
          drawText(String(aluno.presencas), colX[2] + 4, y, { size: 8 });
          drawText(String(aluno.faltas), colX[3] + 4, y, { size: 8 });
          drawText(String(aluno.faltasJustificadas), colX[4] + 4, y, { size: 8 });
          drawText(`${aluno.frequenciaPercentual}%`, colX[5] + 4, y, { size: 8 });
          y -= 16;
        }
        y -= 16;
      }
    }

    this.adicionarRodapes(pdfDoc, font, margin, data.emitidoEm);
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
