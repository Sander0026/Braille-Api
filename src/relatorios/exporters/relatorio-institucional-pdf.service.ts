import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { RelatorioExportacao } from '../relatorios.service';

type PdfOptions = {
  emissorNome?: string;
  emissorPerfil?: string;
  emitidoEm?: Date;
};

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
};

const A4 = { width: 595.28, height: 841.89 };
const INSTITUICAO = {
  nome: process.env.INSTITUICAO_NOME || 'Instituto Luiz Braille',
  subtitulo: 'Relatorio Institucional de Atendimento',
};

@Injectable()
export class RelatorioInstitucionalPdfService {
  async gerar(relatorio: RelatorioExportacao, options: PdfOptions = {}): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    const contentWidth = A4.width - margin * 2;
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

    const drawParagraph = (text: string, opts: TextOptions & { gap?: number } = {}) => {
      const size = opts.size ?? 9;
      const lineHeight = size + 4;
      const lines = this.quebrarLinhas(text, opts.bold ? fontBold : font, size, contentWidth);

      for (const line of lines) {
        ensureSpace(lineHeight);
        drawText(line, margin, y, opts);
        y -= lineHeight;
      }

      y -= opts.gap ?? 8;
    };

    const drawMetric = (label: string, value: string | number, col: number, row: number) => {
      const gap = 8;
      const width = (contentWidth - gap * 2) / 3;
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

    const drawMetrics = (metrics: Array<[string, string | number]>) => {
      const rows = Math.ceil(metrics.length / 3);
      ensureSpace(rows * 46 + 8);
      metrics.forEach(([label, value], index) => drawMetric(label, value, index % 3, Math.floor(index / 3)));
      y -= rows * 46 + 16;
    };

    const drawList = (title: string, rows: string[]) => {
      drawSectionTitle(title);
      if (!rows.length) {
        drawParagraph('Sem dados para os filtros informados.', { color: rgb(0.38, 0.44, 0.52) });
        return;
      }

      for (const row of rows.slice(0, 10)) {
        ensureSpace(18);
        drawText(`- ${this.limitarTexto(row, 112)}`, margin, y, { size: 8.2 });
        y -= 15;
      }

      if (rows.length > 10) {
        drawText(`Mais ${rows.length - 10} registro(s) disponiveis na exportacao XLSX.`, margin, y, {
          size: 8,
          color: rgb(0.38, 0.44, 0.52),
        });
        y -= 18;
      }

      y -= 8;
    };

    const alunosAtivos = relatorio.resumo.alunos.ativos;
    const atendimentosRealizados = relatorio.atendimentos.porTipoRegistro.ATENDIMENTO_REALIZADO ?? 0;
    const turmasOfertadas = relatorio.resumo.turmas.total;
    const totalEvasoes = relatorio.evasoes.indicadores.totalEvasoes;
    const principaisMotivos = this.topEntries(relatorio.evasoes.indicadores.porMotivo, 3);
    const textoMotivos = principaisMotivos.length
      ? principaisMotivos.map(([motivo]) => this.formatarEnum(motivo)).join(', ')
      : 'sem motivo predominante informado';

    drawHeader();
    drawText('Relatorio Institucional de Atendimento', margin, y, {
      size: 19,
      bold: true,
      color: rgb(0.06, 0.1, 0.18),
    });
    y -= 24;
    drawText(INSTITUICAO.nome, margin, y, { size: 12, bold: true, color: rgb(0.15, 0.18, 0.25) });
    y -= 20;
    drawText(`Periodo analisado: ${this.descreverPeriodo(relatorio.filtros)}`, margin, y, {
      size: 9,
      color: rgb(0.38, 0.44, 0.52),
    });
    y -= 16;
    drawText(this.descreverFiltros(relatorio.filtros), margin, y, { size: 8, color: rgb(0.38, 0.44, 0.52) });
    y -= 28;

    drawSectionTitle('Resumo executivo');
    drawParagraph(
      `No periodo analisado, a instituicao manteve ${alunosAtivos} alunos ativos, realizou ${atendimentosRealizados} atendimentos individuais e ofertou ${turmasOfertadas} turmas. Foram registradas ${totalEvasoes} evasoes, sendo os principais motivos: ${textoMotivos}.`,
      { size: 9.5 },
    );
    drawParagraph(
      'Este documento consolida dados academicos, sociais e de acompanhamento individual para apoiar prestacao de contas, leitura institucional e tomada de decisao junto a empresas, governo, apoiadores e parceiros.',
      { size: 9.5 },
    );

    drawSectionTitle('Indicadores principais');
    drawMetrics([
      ['Alunos ativos', alunosAtivos],
      ['Alunos inativos', relatorio.resumo.alunos.inativos],
      ['Novos no periodo', relatorio.resumo.alunos.novosNoPeriodo],
      ['Turmas ofertadas', turmasOfertadas],
      ['Vagas ocupadas', relatorio.turmas.indicadores.vagasOcupadas],
      ['Ocupacao media', `${relatorio.turmas.indicadores.taxaMediaOcupacao}%`],
      ['Atendimentos realizados', atendimentosRealizados],
      ['Evasoes', totalEvasoes],
      ['Taxa de evasao', `${relatorio.resumo.indicadores.taxaEvasao}%`],
      ['Taxa de conclusao', `${relatorio.resumo.indicadores.taxaConclusao}%`],
      ['Taxa de permanencia', `${relatorio.resumo.indicadores.taxaPermanencia}%`],
      ['Taxa de presenca', `${relatorio.frequencias.taxaPresenca}%`],
    ]);

    drawSectionTitle('Perfil dos alunos');
    drawParagraph(
      `O cadastro institucional registra ${relatorio.resumo.alunos.total} alunos, com ${relatorio.alunos.indicadores.comLaudo} aluno(s) com laudo, ${relatorio.alunos.indicadores.semLaudo} sem laudo informado e ${relatorio.alunos.indicadores.precisamAcompanhante} que necessitam de acompanhante.`,
    );
    drawMetrics([
      ['Com laudo', relatorio.alunos.indicadores.comLaudo],
      ['Sem laudo', relatorio.alunos.indicadores.semLaudo],
      ['Acompanhante', relatorio.alunos.indicadores.precisamAcompanhante],
      ['Beneficio governo', relatorio.alunos.indicadores.recebemBeneficioGov],
      ['LGPD aceito', relatorio.alunos.indicadores.lgpdAceito],
      ['Ativos', relatorio.resumo.alunos.ativos],
    ]);
    drawList(
      'Principais perfis dos alunos',
      [
        ...this.topEntries(relatorio.alunos.indicadores.porTipoDeficiencia, 5).map(
          ([tipo, total]) => `${this.formatarEnum(tipo)}: ${total} aluno(s)`,
        ),
        ...this.topEntries(relatorio.alunos.indicadores.porCidade, 5).map(
          ([cidade, total]) => `${cidade}: ${total} aluno(s)`,
        ),
      ],
    );

    drawSectionTitle('Turmas ofertadas');
    drawParagraph(
      `Foram consideradas ${relatorio.turmas.indicadores.totalTurmas} turmas, com ${relatorio.turmas.indicadores.totalVagas} vagas totais e ${relatorio.turmas.indicadores.vagasOcupadas} vagas ocupadas. A taxa media de ocupacao foi de ${relatorio.turmas.indicadores.taxaMediaOcupacao}%.`,
    );
    drawMetrics([
      ['Previstas', relatorio.turmas.indicadores.previstas],
      ['Em andamento', relatorio.turmas.indicadores.andamento],
      ['Concluidas', relatorio.turmas.indicadores.concluidas],
      ['Canceladas', relatorio.turmas.indicadores.canceladas],
      ['Arquivadas', relatorio.turmas.indicadores.arquivadas],
      ['Vagas totais', relatorio.turmas.indicadores.totalVagas],
    ]);

    drawSectionTitle('Evasoes e motivos');
    drawParagraph(
      `O periodo apresentou ${totalEvasoes} evasao(oes), ${relatorio.evasoes.indicadores.totalTransferencias} transferencia(s) e ${relatorio.evasoes.indicadores.totalCancelamentos} cancelamento(s). O registro estruturado dos motivos permite diferenciar evasao, transferencia e cancelamento administrativo.`,
    );
    drawMetrics([
      ['Com atendimento individual', relatorio.evasoes.indicadores.evasoesComAtendimentoIndividual],
      ['Sem atendimento individual', relatorio.evasoes.indicadores.evasoesSemAtendimentoIndividual],
      ['Com faltas no atendimento', relatorio.evasoes.indicadores.evasoesComFaltasEmAtendimento],
      ['Acompanhamento finalizado', relatorio.evasoes.indicadores.evasoesComAcompanhamentoFinalizado],
      ['Acompanhamento arquivado', relatorio.evasoes.indicadores.evasoesComAcompanhamentoArquivado],
      ['Permanencia media', `${relatorio.evasoes.indicadores.tempoMedioPermanenciaDias} dias`],
    ]);
    drawList(
      'Principais motivos de evasao',
      principaisMotivos.map(([motivo, total]) => `${this.formatarEnum(motivo)}: ${total} registro(s)`),
    );

    drawSectionTitle('Atendimentos individuais');
    drawParagraph(
      `O modulo de atendimentos individuais registrou ${relatorio.atendimentos.total} ocorrencia(s), incluindo ${atendimentosRealizados} atendimento(s) realizado(s), ${relatorio.atendimentos.porTipoRegistro.FALTA_JUSTIFICADA ?? 0} falta(s) justificada(s), ${relatorio.atendimentos.porTipoRegistro.FALTA_NAO_JUSTIFICADA ?? 0} falta(s) nao justificada(s) e ${relatorio.atendimentos.porTipoRegistro.CANCELADO ?? 0} cancelamento(s).`,
    );
    drawList(
      'Distribuicao dos atendimentos individuais',
      [
        ...this.topEntries(relatorio.atendimentos.porTipoRegistro, 6).map(
          ([tipo, total]) => `${this.formatarEnum(tipo)}: ${total} registro(s)`,
        ),
        ...this.topEntries(
          this.agruparPor(relatorio.atendimentos.data, (item) => item.modalidade ?? 'Nao informado'),
          6,
        ).map(([modalidade, total]) => `${this.formatarEnum(modalidade)}: ${total} registro(s)`),
      ],
    );

    drawSectionTitle('Conclusao institucional');
    drawParagraph(
      'Os indicadores demonstram a capacidade da instituicao de acompanhar estudantes, organizar turmas, registrar frequencias e documentar motivos de encerramento de matriculas. A consolidacao destes dados fortalece a transparencia institucional e subsidia a continuidade de parcerias, convenios e acoes de impacto social.',
      { size: 9.5 },
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

  private descreverPeriodo(filtros: { dataInicio?: string; dataFim?: string }): string {
    if (filtros.dataInicio && filtros.dataFim) return `${filtros.dataInicio} a ${filtros.dataFim}`;
    if (filtros.dataInicio) return `a partir de ${filtros.dataInicio}`;
    if (filtros.dataFim) return `ate ${filtros.dataFim}`;
    return 'todos os registros disponiveis';
  }

  private descreverFiltros(filtros: object): string {
    const chavesPublicas = new Set([
      'dataInicio',
      'dataFim',
      'statusAluno',
      'statusTurma',
      'statusMatricula',
      'motivoEncerramento',
      'cidade',
      'bairro',
      'tipoDeficiencia',
    ]);
    const entries = Object.entries(filtros).filter(
      ([key, value]) => chavesPublicas.has(key) && value !== undefined && value !== null && value !== '',
    );
    if (!entries.length) return 'Filtros: todos os registros permitidos';
    return `Filtros: ${entries.map(([key, value]) => `${key}=${value}`).join('; ')}`;
  }

  private agruparPor<T>(items: T[], resolver: (item: T) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = resolver(item) || 'Nao informado';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private topEntries(record: Record<string, number>, limit: number): Array<[string, number]> {
    return Object.entries(record)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit);
  }

  private quebrarLinhas(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = this.normalizarTexto(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      current = word;
    }

    if (current) lines.push(current);
    return lines.length ? lines : [''];
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

  private formatarEnum(value?: string | null): string {
    if (!value) return 'Nao informado';
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
