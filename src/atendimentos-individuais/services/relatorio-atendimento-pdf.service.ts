import { Injectable } from '@nestjs/common';
import { TipoRegistroAtendimentoIndividual } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { PDFDocument, PDFImage, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

type PdfOptions = {
  emissorNome?: string;
  emissorPerfil?: string;
  emitidoEm?: Date;
};

type PdfTheme = {
  title: ReturnType<typeof rgb>;
  text: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  border: ReturnType<typeof rgb>;
  soft: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  white: ReturnType<typeof rgb>;
};

const A4 = { width: 595.28, height: 841.89 };
const INSTITUICAO = {
  nome: process.env.INSTITUICAO_NOME || 'Instituto Luiz Braille do Espirito Santo',
  subtitulo: process.env.INSTITUICAO_SUBTITULO || 'Relatorio institucional de atendimento individual',
  cnpj: process.env.INSTITUICAO_CNPJ || '',
  endereco: process.env.INSTITUICAO_ENDERECO || '',
  contato: process.env.INSTITUICAO_CONTATO || 'Documento interno - uso administrativo e pedagogico',
  logoPath: process.env.ATENDIMENTO_RELATORIO_LOGO_PATH || process.env.INSTITUICAO_LOGO_PATH || '',
};

@Injectable()
export class RelatorioAtendimentoPdfService {
  async gerar(relatorio: any, options: PdfOptions = {}): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const logoImage = await this.carregarLogo(pdfDoc);
    const margin = 42;
    const theme: PdfTheme = {
      title: rgb(0.06, 0.1, 0.18),
      text: rgb(0.15, 0.18, 0.25),
      muted: rgb(0.38, 0.44, 0.52),
      border: rgb(0.82, 0.86, 0.9),
      soft: rgb(0.96, 0.97, 0.98),
      accent: rgb(0.86, 0.69, 0),
      white: rgb(1, 1, 1),
    };
    const emitidoEm = options.emitidoEm ?? new Date();
    const emissorNome = options.emissorNome || 'Usuario autenticado';
    const emissorPerfil = options.emissorPerfil || 'Perfil nao informado';

    let page = pdfDoc.addPage([A4.width, A4.height]);
    let y = A4.height - margin;

    const addPage = () => {
      page = pdfDoc.addPage([A4.width, A4.height]);
      y = A4.height - margin;
      drawHeader();
    };

    const ensureSpace = (requiredHeight: number) => {
      if (y - requiredHeight >= margin + 44) return;
      addPage();
    };

    const drawLogo = (x: number, logoY: number) => {
      if (logoImage) {
        const maxSize = 42;
        const scale = Math.min(maxSize / logoImage.width, maxSize / logoImage.height);
        const width = logoImage.width * scale;
        const height = logoImage.height * scale;
        page.drawImage(logoImage, { x, y: logoY - height - 1, width, height });
        return;
      }

      page.drawCircle({ x: x + 22, y: logoY - 16, size: 21, color: theme.accent });
      page.drawCircle({ x: x + 22, y: logoY - 16, size: 17, color: theme.white });
      page.drawText('ILB', { x: x + 9, y: logoY - 22, size: 12, font: fontBold, color: theme.title });
    };

    const drawHeader = () => {
      drawLogo(margin, y);
      page.drawText(INSTITUICAO.nome, { x: margin + 54, y: y - 4, size: 12, font: fontBold, color: theme.title });
      page.drawText(INSTITUICAO.subtitulo, { x: margin + 54, y: y - 20, size: 9, font, color: theme.muted });
      page.drawText(this.limitar(this.descreverDadosInstituicao(), 64), { x: margin + 54, y: y - 34, size: 8, font, color: theme.muted });
      page.drawText(`Emitido em: ${this.formatarDataHora(emitidoEm)}`, { x: A4.width - margin - 172, y: y - 4, size: 8, font, color: theme.muted });
      page.drawText(`Emissor: ${this.limitar(emissorNome, 34)}`, { x: A4.width - margin - 172, y: y - 18, size: 8, font, color: theme.muted });
      page.drawText(`Perfil: ${emissorPerfil}`, { x: A4.width - margin - 172, y: y - 32, size: 8, font, color: theme.muted });
      page.drawRectangle({ x: margin, y: y - 48, width: A4.width - margin * 2, height: 2, color: theme.accent });
      y -= 72;
    };

    const drawText = (
      text: string,
      x: number,
      textY: number,
      optionsText: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
    ) => {
      page.drawText(this.normalizarTexto(text), {
        x,
        y: textY,
        size: optionsText.size ?? 9,
        font: optionsText.bold ? fontBold : font,
        color: optionsText.color ?? theme.text,
      });
    };

    const drawWrapped = (
      text: string,
      x: number,
      width: number,
      optionsText: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; lineHeight?: number } = {},
    ) => {
      const size = optionsText.size ?? 9;
      const lineHeight = optionsText.lineHeight ?? 13;
      const maxChars = Math.max(20, Math.floor(width / (size * 0.48)));
      const lines = this.quebrarTexto(this.normalizarTexto(text), maxChars);
      for (const line of lines) {
        ensureSpace(lineHeight);
        drawText(line, x, y, optionsText);
        y -= lineHeight;
      }
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(28);
      page.drawRectangle({ x: margin, y: y - 5, width: A4.width - margin * 2, height: 22, color: theme.soft });
      drawText(title, margin + 9, y, { size: 10, bold: true, color: theme.title });
      y -= 30;
    };

    const drawField = (label: string, value: string, x: number, fieldY: number, width: number) => {
      page.drawRectangle({ x, y: fieldY - 22, width, height: 34, borderColor: theme.border, borderWidth: 0.7, color: theme.white });
      drawText(label.toUpperCase(), x + 7, fieldY + 1, { size: 6.5, bold: true, color: theme.muted });
      drawText(this.limitar(value || 'Nao informado', Math.floor(width / 4.7)), x + 7, fieldY - 13, { size: 9, color: theme.text });
    };

    const drawSummary = () => {
      drawSectionTitle('Resumo quantitativo');
      const cardGap = 8;
      const cardWidth = (A4.width - margin * 2 - cardGap * 2) / 3;
      const cards = [
        ['Acompanhamentos', String(relatorio.totalAcompanhamentos ?? 0)],
        ['Registros', String(relatorio.totalRegistros ?? 0)],
        ['Realizados', String(relatorio.totais?.atendimentosRealizados ?? 0)],
        ['Faltas justificadas', String(relatorio.totais?.faltasJustificadas ?? 0)],
        ['Com comprovante', String(relatorio.totais?.faltasJustificadasComComprovante ?? 0)],
        ['Sem comprovante', String(relatorio.totais?.faltasJustificadasSemComprovante ?? 0)],
        ['Nao justificadas', String(relatorio.totais?.faltasNaoJustificadas ?? 0)],
        ['Cancelados', String(relatorio.totais?.cancelados ?? 0)],
      ];

      cards.forEach(([label, value], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = margin + col * (cardWidth + cardGap);
        const cardY = y - row * 46;
        page.drawRectangle({ x, y: cardY - 34, width: cardWidth, height: 38, borderColor: theme.border, borderWidth: 0.7, color: theme.white });
        drawText(label, x + 8, cardY - 8, { size: 8, color: theme.muted });
        drawText(value, x + 8, cardY - 25, { size: 14, bold: true, color: theme.title });
      });
      y -= Math.ceil(cards.length / 3) * 46 + 8;
    };

    const drawSignatureBlock = (professorNome: string) => {
      ensureSpace(92);
      y -= 24;
      const lineWidth = 220;
      const centerX = A4.width / 2;
      page.drawLine({
        start: { x: centerX - lineWidth / 2, y },
        end: { x: centerX + lineWidth / 2, y },
        thickness: 0.8,
        color: theme.border,
      });
      drawText(this.limitar(professorNome || 'Professor responsavel', 42), centerX - 96, y - 16, { size: 9, bold: true, color: theme.title });
      drawText('Professor responsavel pelo acompanhamento', centerX - 88, y - 29, { size: 8, color: theme.muted });
      y -= 54;
    };

    const drawAtendimentosTable = (atendimentos: any[]) => {
      if (!atendimentos.length) {
        drawWrapped('Nenhum atendimento registrado para este acompanhamento no filtro aplicado.', margin, A4.width - margin * 2, { color: theme.muted });
        return;
      }

      const cols = [
        { label: 'Data', width: 58 },
        { label: 'Tipo', width: 103 },
        { label: 'Horario', width: 72 },
        { label: 'Modalidade', width: 76 },
        { label: 'Registro', width: A4.width - margin * 2 - 58 - 103 - 72 - 76 },
      ];

      const drawTableHeader = () => {
        ensureSpace(28);
        let x = margin;
        page.drawRectangle({ x: margin, y: y - 18, width: A4.width - margin * 2, height: 22, color: theme.soft, borderColor: theme.border, borderWidth: 0.6 });
        cols.forEach((col) => {
          drawText(col.label, x + 5, y - 10, { size: 7.5, bold: true, color: theme.title });
          x += col.width;
        });
        y -= 24;
      };

      drawTableHeader();
      for (const atendimento of atendimentos) {
        const registro = this.descreverRegistroAtendimento(atendimento);
        const rowHeight = Math.max(30, this.quebrarTexto(registro, 52).length * 11 + 12);
        ensureSpace(rowHeight + 8);
        if (y < margin + 95) drawTableHeader();

        let x = margin;
        page.drawRectangle({ x: margin, y: y - rowHeight + 8, width: A4.width - margin * 2, height: rowHeight, borderColor: theme.border, borderWidth: 0.5, color: theme.white });
        const values = [
          this.formatarData(atendimento.dataAtendimento),
          this.formatarTipoRegistro(atendimento.tipoRegistro),
          this.descreverHorario(atendimento),
          atendimento.modalidade ? this.formatarEnum(atendimento.modalidade) : '-',
        ];

        values.forEach((value, index) => {
          drawText(this.limitar(value, index === 1 ? 22 : 14), x + 5, y - 8, { size: 7.5, color: theme.text });
          x += cols[index].width;
        });

        const linhasRegistro = this.quebrarTexto(registro, 52);
        let textY = y - 8;
        for (const linha of linhasRegistro) {
          drawText(linha, x + 5, textY, { size: 7.5, color: theme.text });
          textY -= 10.5;
        }
        y -= rowHeight + 4;
      }
    };

    drawHeader();
    drawText('Relatorio de Atendimento Individual', margin, y, { size: 18, bold: true, color: theme.title });
    y -= 22;
    drawWrapped('Documento gerado para acompanhamento pedagogico individual. As informacoes sao restritas aos perfis autorizados e devem ser tratadas conforme as regras internas de privacidade.', margin, A4.width - margin * 2, { size: 9, color: theme.muted });
    y -= 8;
    drawSectionTitle('Filtros aplicados');
    drawWrapped(this.descreverFiltros(relatorio.filtros), margin, A4.width - margin * 2, { size: 9, color: theme.text });
    y -= 8;
    drawSummary();

    const acompanhamentos = (relatorio.acompanhamentos ?? []) as any[];
    acompanhamentos.forEach((acompanhamento) => {
      addPage();
      drawSectionTitle('Dados do acompanhamento');
      const fullWidth = A4.width - margin * 2;
      const colWidth = (fullWidth - 10) / 2;
      drawField('Aluno', acompanhamento.aluno?.nomeCompleto ?? 'Aluno', margin, y, colWidth);
      drawField('Matricula', acompanhamento.aluno?.matricula ?? 'Nao informada', margin + colWidth + 10, y, colWidth);
      y -= 44;
      drawField('Professor responsavel', acompanhamento.professor?.nome ?? 'Nao informado', margin, y, colWidth);
      drawField('Status', this.formatarEnum(acompanhamento.status), margin + colWidth + 10, y, colWidth);
      y -= 44;
      drawField('Assunto principal', acompanhamento.assuntoAtual ?? 'Nao informado', margin, y, fullWidth);
      y -= 46;
      drawWrapped(`Periodo: inicio em ${this.formatarData(acompanhamento.dataInicio)}${acompanhamento.dataFinalizacao ? `; finalizacao em ${this.formatarData(acompanhamento.dataFinalizacao)}` : ''}.`, margin, fullWidth, { size: 9, color: theme.muted });
      if (acompanhamento.resultadoFinal) drawWrapped(`Resultado final: ${acompanhamento.resultadoFinal}`, margin, fullWidth, { size: 9 });
      if (acompanhamento.resumoFinal) drawWrapped(`Resumo final: ${acompanhamento.resumoFinal}`, margin, fullWidth, { size: 9 });
      y -= 6;
      drawSectionTitle('Atendimentos registrados');
      drawAtendimentosTable(acompanhamento.atendimentos ?? []);
      drawSignatureBlock(acompanhamento.professor?.nome ?? '');
    });

    this.adicionarRodapes(pdfDoc, font, theme.muted, margin, emitidoEm, emissorNome);
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private adicionarRodapes(
    pdfDoc: PDFDocument,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    margin: number,
    emitidoEm: Date,
    emissorNome: string,
  ): void {
    const pages = pdfDoc.getPages();
    pages.forEach((page: PDFPage, index: number) => {
      page.drawText(`Pagina ${index + 1} de ${pages.length}`, { x: margin, y: 24, size: 8, font, color });
      page.drawText(`Emitido em ${this.formatarDataHora(emitidoEm)} por ${this.limitar(emissorNome, 40)}`, {
        x: margin + 94,
        y: 24,
        size: 8,
        font,
        color,
      });
    });
  }

  private async carregarLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
    if (!INSTITUICAO.logoPath) return null;

    try {
      const logoPath = resolve(INSTITUICAO.logoPath);
      const bytes = await readFile(logoPath);
      const extension = extname(logoPath).toLowerCase();

      if (extension === '.png') return pdfDoc.embedPng(bytes);
      if (extension === '.jpg' || extension === '.jpeg') return pdfDoc.embedJpg(bytes);
      return null;
    } catch {
      return null;
    }
  }

  private descreverDadosInstituicao(): string {
    return [INSTITUICAO.cnpj ? `CNPJ: ${INSTITUICAO.cnpj}` : null, INSTITUICAO.endereco, INSTITUICAO.contato]
      .filter(Boolean)
      .join(' | ');
  }

  private descreverFiltros(filtros: Record<string, unknown> = {}): string {
    const partes = [
      filtros['alunoId'] ? 'Aluno selecionado' : 'Todos os alunos permitidos',
      filtros['professorId'] ? 'Professor selecionado' : 'Todos os professores permitidos',
      filtros['dataInicio'] || filtros['dataFim'] ? `Periodo ${filtros['dataInicio'] ?? 'inicio'} a ${filtros['dataFim'] ?? 'hoje'}` : 'Todo o periodo',
      filtros['status'] ? `Status ${this.formatarEnum(String(filtros['status']))}` : 'Todos os status',
      filtros['tipoRegistro'] ? `Tipo ${this.formatarTipoRegistro(filtros['tipoRegistro'] as TipoRegistroAtendimentoIndividual)}` : 'Todos os tipos',
    ];
    return partes.join('; ');
  }

  private descreverDetalhesAtendimento(atendimento: any): string {
    const partes = [
      atendimento.horaInicio ? `Inicio ${atendimento.horaInicio}` : null,
      atendimento.horaFim ? `Fim ${atendimento.horaFim}` : null,
      atendimento.duracaoMinutos ? `${atendimento.duracaoMinutos} min` : null,
      atendimento.modalidade ? `Modalidade ${this.formatarEnum(atendimento.modalidade)}` : null,
      atendimento.localAtendimento ? `Local ${atendimento.localAtendimento}` : null,
    ].filter(Boolean);
    return partes.join(' | ');
  }

  private descreverHorario(atendimento: any): string {
    const intervalo = [atendimento.horaInicio, atendimento.horaFim].filter(Boolean).join('-');
    if (intervalo && atendimento.duracaoMinutos) return `${intervalo} (${atendimento.duracaoMinutos}m)`;
    if (intervalo) return intervalo;
    return atendimento.duracaoMinutos ? `${atendimento.duracaoMinutos}m` : '-';
  }

  private descreverRegistroAtendimento(atendimento: any): string {
    const partes = [
      atendimento.localAtendimento ? `Local: ${atendimento.localAtendimento}` : null,
      atendimento.assuntoDoDia ? `Assunto: ${atendimento.assuntoDoDia}` : null,
      atendimento.observacao ? `Obs.: ${atendimento.observacao}` : null,
      atendimento.evolucao ? `Evolucao: ${atendimento.evolucao}` : null,
      atendimento.dificuldades ? `Dificuldades: ${atendimento.dificuldades}` : null,
      atendimento.pendencias ? `Pendencias: ${atendimento.pendencias}` : null,
      atendimento.recomendacoes ? `Recomendacoes: ${atendimento.recomendacoes}` : null,
      atendimento.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA
        ? `Comprovante: ${atendimento.temComprovante ? 'sim' : 'nao'}`
        : null,
      atendimento.arquivos?.length ? `Arquivos anexados: ${atendimento.arquivos.length}` : null,
    ].filter(Boolean);
    return partes.join(' | ') || 'Registro sem observacoes adicionais.';
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private asciiFallback(char: string): string {
    const map: Record<string, string> = {
      á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
      Á: 'A', À: 'A', Â: 'A', Ã: 'A', Ä: 'A',
      é: 'e', ê: 'e', ë: 'e',
      É: 'E', Ê: 'E', Ë: 'E',
      í: 'i', î: 'i', ï: 'i',
      Í: 'I', Î: 'I', Ï: 'I',
      ó: 'o', ô: 'o', õ: 'o', ö: 'o',
      Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O',
      ú: 'u', û: 'u', ü: 'u',
      Ú: 'U', Û: 'U', Ü: 'U',
      ç: 'c', Ç: 'C',
    };
    return map[char] ?? '';
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

  private formatarEnum(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private limitar(value: string, max: number): string {
    const normalized = this.normalizarTexto(value);
    return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 3))}...` : normalized;
  }
}
