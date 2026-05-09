import { Injectable } from '@nestjs/common';
import { TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

@Injectable()
export class RelatorioAtendimentoPdfService {
  async gerar(relatorio: any): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 44;
    const lineHeight = 15;
    const titleColor = rgb(0.06, 0.1, 0.18);
    const textColor = rgb(0.15, 0.18, 0.25);
    const mutedColor = rgb(0.38, 0.44, 0.52);
    const accentColor = rgb(0.86, 0.69, 0);

    let page = pdfDoc.addPage([595.28, 841.89]);
    let y = page.getHeight() - margin;

    const drawHeader = () => {
      page.drawText('Instituto Luiz Braille', {
        x: margin,
        y,
        size: 13,
        font: fontBold,
        color: titleColor,
      });
      page.drawText('Relatorio de Atendimento Individual', {
        x: margin,
        y: y - 18,
        size: 18,
        font: fontBold,
        color: titleColor,
      });
      page.drawRectangle({
        x: margin,
        y: y - 30,
        width: page.getWidth() - margin * 2,
        height: 2,
        color: accentColor,
      });
      y -= 52;
    };

    const addPageIfNeeded = (requiredHeight = lineHeight) => {
      if (y - requiredHeight >= margin + 28) return;
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
      drawHeader();
    };

    const drawLine = (text: string, options: { bold?: boolean; size?: number; indent?: number; color?: ReturnType<typeof rgb> } = {}) => {
      const size = options.size ?? 10;
      const selectedFont = options.bold ? fontBold : font;
      const indent = options.indent ?? 0;
      const maxChars = Math.max(36, Math.floor((page.getWidth() - margin * 2 - indent) / (size * 0.48)));
      const linhas = this.quebrarTexto(this.normalizarTexto(text), maxChars);

      for (const linha of linhas) {
        addPageIfNeeded(lineHeight);
        page.drawText(linha, {
          x: margin + indent,
          y,
          size,
          font: selectedFont,
          color: options.color ?? textColor,
        });
        y -= lineHeight;
      }
    };

    const drawSectionTitle = (title: string) => {
      addPageIfNeeded(28);
      y -= 4;
      page.drawRectangle({
        x: margin,
        y: y - 3,
        width: page.getWidth() - margin * 2,
        height: 20,
        color: rgb(0.96, 0.97, 0.98),
      });
      page.drawText(title, { x: margin + 8, y: y + 2, size: 11, font: fontBold, color: titleColor });
      y -= 24;
    };

    drawHeader();
    drawLine(`Emitido em: ${this.formatarDataHora(new Date())}`, { color: mutedColor });
    drawLine(`Filtros: ${this.descreverFiltros(relatorio.filtros)}`, { color: mutedColor });

    drawSectionTitle('Resumo quantitativo');
    drawLine(`Total de acompanhamentos: ${relatorio.totalAcompanhamentos}`, { bold: true });
    drawLine(`Total de registros: ${relatorio.totalRegistros}`, { bold: true });
    drawLine(`Atendimentos realizados: ${relatorio.totais.atendimentosRealizados}`);
    drawLine(`Faltas justificadas: ${relatorio.totais.faltasJustificadas}`);
    drawLine(`Faltas justificadas com comprovante: ${relatorio.totais.faltasJustificadasComComprovante ?? 0}`);
    drawLine(`Faltas justificadas sem comprovante: ${relatorio.totais.faltasJustificadasSemComprovante ?? 0}`);
    drawLine(`Faltas nao justificadas: ${relatorio.totais.faltasNaoJustificadas}`);
    drawLine(`Cancelados: ${relatorio.totais.cancelados}`);

    for (const acompanhamento of relatorio.acompanhamentos as any[]) {
      drawSectionTitle(`${acompanhamento.aluno?.nomeCompleto ?? 'Aluno'} - ${acompanhamento.assuntoAtual}`);
      drawLine(`Professor: ${acompanhamento.professor?.nome ?? 'Nao informado'} | Status: ${acompanhamento.status}`);
      drawLine(`Inicio: ${this.formatarData(acompanhamento.dataInicio)}${acompanhamento.dataFinalizacao ? ` | Finalizacao: ${this.formatarData(acompanhamento.dataFinalizacao)}` : ''}`);
      if (acompanhamento.resultadoFinal) drawLine(`Resultado final: ${acompanhamento.resultadoFinal}`);
      if (acompanhamento.resumoFinal) drawLine(`Resumo final: ${acompanhamento.resumoFinal}`);

      for (const atendimento of acompanhamento.atendimentos ?? []) {
        drawLine(`${this.formatarData(atendimento.dataAtendimento)} - ${this.formatarTipoRegistro(atendimento.tipoRegistro)}`, {
          bold: true,
          indent: 12,
        });
        const detalhes = this.descreverDetalhesAtendimento(atendimento);
        if (detalhes) drawLine(detalhes, { indent: 24, color: mutedColor });
        if (atendimento.assuntoDoDia) drawLine(`Assunto: ${atendimento.assuntoDoDia}`, { indent: 24 });
        if (atendimento.observacao) drawLine(`Observacao: ${atendimento.observacao}`, { indent: 24 });
        if (atendimento.evolucao) drawLine(`Evolucao: ${atendimento.evolucao}`, { indent: 24 });
        if (atendimento.dificuldades) drawLine(`Dificuldades: ${atendimento.dificuldades}`, { indent: 24 });
        if (atendimento.pendencias) drawLine(`Pendencias: ${atendimento.pendencias}`, { indent: 24 });
        if (atendimento.recomendacoes) drawLine(`Recomendacoes: ${atendimento.recomendacoes}`, { indent: 24 });
        if (atendimento.arquivos?.length) drawLine(`Arquivos anexados: ${atendimento.arquivos.length}`, { indent: 24 });
      }
    }

    this.adicionarRodapes(pdfDoc, font, mutedColor, margin);
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private adicionarRodapes(pdfDoc: PDFDocument, font: PDFFont, color: ReturnType<typeof rgb>, margin: number): void {
    const pages = pdfDoc.getPages();
    pages.forEach((page: PDFPage, index: number) => {
      page.drawText(`Pagina ${index + 1} de ${pages.length}`, {
        x: margin,
        y: 24,
        size: 8,
        font,
        color,
      });
      page.drawText('Documento emitido pelo sistema administrativo do Instituto Luiz Braille.', {
        x: margin + 95,
        y: 24,
        size: 8,
        font,
        color,
      });
    });
  }

  private descreverFiltros(filtros: Record<string, unknown> = {}): string {
    const partes = [
      filtros['alunoId'] ? 'aluno selecionado' : 'todos os alunos',
      filtros['professorId'] ? 'professor selecionado' : 'todos os professores permitidos',
      filtros['dataInicio'] || filtros['dataFim'] ? `periodo ${filtros['dataInicio'] ?? 'inicio'} a ${filtros['dataFim'] ?? 'hoje'}` : 'todo o periodo',
      filtros['status'] ? `status ${filtros['status']}` : 'todos os status',
      filtros['tipoRegistro'] ? `tipo ${filtros['tipoRegistro']}` : 'todos os tipos',
    ];
    return partes.join('; ');
  }

  private descreverDetalhesAtendimento(atendimento: any): string {
    const partes = [
      atendimento.horaInicio ? `Inicio ${atendimento.horaInicio}` : null,
      atendimento.horaFim ? `Fim ${atendimento.horaFim}` : null,
      atendimento.duracaoMinutos ? `${atendimento.duracaoMinutos} min` : null,
      atendimento.modalidade ? `Modalidade ${atendimento.modalidade}` : null,
      atendimento.localAtendimento ? `Local ${atendimento.localAtendimento}` : null,
    ].filter(Boolean);
    return partes.join(' | ');
  }

  private quebrarTexto(texto: string, maxChars: number): string[] {
    const words = texto.split(/\s+/);
    const linhas: string[] = [];
    let linha = '';

    for (const word of words) {
      const candidate = linha ? `${linha} ${word}` : word;
      if (candidate.length <= maxChars) {
        linha = candidate;
        continue;
      }
      if (linha) linhas.push(linha);
      linha = word;
    }

    if (linha) linhas.push(linha);
    return linhas.length ? linhas : [''];
  }

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .normalize('NFC')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatarData(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data nao informada';
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private formatarDataHora(date: Date): string {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private formatarTipoRegistro(tipo: TipoRegistroAtendimentoIndividual): string {
    const labels: Record<TipoRegistroAtendimentoIndividual, string> = {
      ATENDIMENTO_REALIZADO: 'Atendimento realizado',
      FALTA_JUSTIFICADA: 'Falta justificada',
      FALTA_NAO_JUSTIFICADA: 'Falta nao justificada',
      CANCELADO: 'Cancelado',
    };
    return labels[tipo] ?? tipo;
  }
}
