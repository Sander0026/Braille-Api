import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as QRCode from 'qrcode';

/** Tipo explícito para os dados do modelo passados ao PDF engine — elimina `as any` */
export type ModeloPdf = {
  arteBaseUrl: string;
  assinaturaUrl: string;
  assinaturaUrl2: string | null;
  layoutConfig: unknown;
  nomeAssinante: string;
  cargoAssinante: string;
  nomeAssinante2?: string | null;
  cargoAssinante2?: string | null;
};

// ── Catálogo de Fontes — URLs estáticas e seguras do Google Fonts (GitHub raw) ────
const FONTS_URLS: Record<string, string> = {
  // Sans-Serif
  Roboto: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Regular.ttf',
  'Open Sans': 'https://raw.githubusercontent.com/google/fonts/main/apache/opensans/static/OpenSans-Regular.ttf',
  Montserrat: 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat-Regular.ttf',
  // Serif
  Merriweather: 'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Regular.ttf',
  Cinzel: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/static/Cinzel-Regular.ttf',
  'Playfair Display':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf',
  // Cursivas elegantes
  'Great Vibes': 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  Parisienne: 'https://raw.githubusercontent.com/google/fonts/main/ofl/parisienne/Parisienne-Regular.ttf',
  'Dancing Script':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/static/DancingScript-Regular.ttf',
  Pacifico: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf',
};

const FONT_FILE_NAMES: Record<string, string> = {
  Roboto: 'Roboto-Regular.ttf',
  'Open Sans': 'OpenSans-Regular.ttf',
  Montserrat: 'Montserrat-Regular.ttf',
  Merriweather: 'Merriweather-Regular.ttf',
  Cinzel: 'Cinzel-Regular.ttf',
  'Playfair Display': 'PlayfairDisplay-Regular.ttf',
  'Great Vibes': 'GreatVibes-Regular.ttf',
  Parisienne: 'Parisienne-Regular.ttf',
  'Dancing Script': 'DancingScript-Regular.ttf',
  Pacifico: 'Pacifico-Regular.ttf',
};

/**
 * Allowlist de hosts HTTPS permitidos para recursos externos.
 * Previne SSRF (CWE-918) em imagens vindas do banco de dados.
 * - res.cloudinary.com: fotos e assinaturas do sistema
 * - raw.githubusercontent.com: fontes do catálogo Google Fonts (hardcoded)
 */
const ALLOWED_IMAGE_HOSTS = ['res.cloudinary.com'];
const ALLOWED_FONT_HOSTS = ['raw.githubusercontent.com'];

function topPctToY(topPct: number, pageHeight: number, elementHeight = 0): number {
  return pageHeight - (topPct / 100) * pageHeight - elementHeight;
}

const CANVAS_REF_W = 1122;
const CANVAS_REF_H = 794;

/** Agrupa os handles do documento PDF para ser passado como parâmetro único */
type PageCtx = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
};

/** Contexto passado ao renderizador de assinatura — agrupa parâmetros para respeitar limite SonarQube (≤ 7) */
type AssinaturaContext = {
  config: Record<string, unknown>;
  nome?: string | null;
  cargo?: string | null;
  assinaturaUrl2: string | null;
  assinatura1?: Record<string, unknown>;
};

type CertificadoPdfElementType =
  | 'TEXT'
  | 'DYNAMIC_TEXT'
  | 'SIGNATURE_IMAGE'
  | 'SIGNATURE_BLOCK'
  | 'QR_CODE'
  | 'VALIDATION_CODE'
  | 'LINE';

type CertificadoPdfElement = {
  id?: string;
  type?: CertificadoPdfElementType;
  label?: string;
  content?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  zIndex?: number;
  visible?: boolean;
  legacyField?: 'textoPronto' | 'nomeAluno' | 'assinatura1' | 'assinatura2' | 'qrCode';
};

type PdfRenderData = {
  textoFormatado: string;
  codigoValidacao: string;
  nomeAluno?: string;
  variables: Record<string, string>;
  modelo: ModeloPdf;
};

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly fontCache = new Map<string, ArrayBuffer>();
  private readonly fontCacheDir: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Resolve a URL do frontend no startup — elimina require('dotenv') em produção (CWE-547)
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'https://instituto-luizbraille.vercel.app';
    this.fontCacheDir =
      this.configService.get<string>('CERTIFICADOS_FONT_CACHE_DIR') ?? join(tmpdir(), 'braille-api-font-cache');
  }

  // ── Validação de URL (SSRF Prevention) ────────────────────────────────────

  /**
   * Valida e sanitiza uma URL para recursos de imagem.
   * Aplica allowlist de hosts (SSRF — CWE-918): apenas res.cloudinary.com é permitido.
   */
  private sanitizeSafeUrl(rawUrl: string, allowedHosts = ALLOWED_IMAGE_HOSTS): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`URL inválida: ${rawUrl}`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Protocolo inseguro — apenas https/http são permitidos.');
    }
    const hostPermitido = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
    if (!hostPermitido) {
      throw new Error(`Host não autorizado: "${parsed.hostname}". Apenas ${allowedHosts.join(', ')} são aceitos.`);
    }
    return parsed.toString();
  }

  // ── Utilitários Internos ───────────────────────────────────────────────────

  private extrairRgb(hexColor?: string): [number, number, number] {
    if (!hexColor) return [0, 0, 0];
    const hex = /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor.replace('#', '') : '000000';
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255;
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255;
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  private pctToX(xPct: number | undefined, pageWidth: number): number {
    return (((xPct ?? 0) / 100) * pageWidth);
  }

  private pctToWidth(widthPct: number | undefined, pageWidth: number, fallbackPct: number): number {
    return (((widthPct ?? fallbackPct) / 100) * pageWidth);
  }

  private pctToHeight(heightPct: number | undefined, pageHeight: number, fallbackPct: number): number {
    return (((heightPct ?? fallbackPct) / 100) * pageHeight);
  }

  private tamanhoFontePdf(fontSize: number | undefined, pageWidth: number, fallback = 16): number {
    return (((fontSize ?? fallback) / CANVAS_REF_W) * pageWidth);
  }

  private normalizarTextoVariavel(texto: string, data: PdfRenderData): string {
    const variables = {
      ...data.variables,
      TEXTO_CERTIFICADO: data.textoFormatado,
      TEXTO_PRINCIPAL: data.textoFormatado,
      ALUNO: data.nomeAluno ?? '',
      NOME_ALUNO: data.nomeAluno ?? '',
      NOME: data.nomeAluno ?? '',
      CODIGO_CERTIFICADO: data.codigoValidacao,
      CODIGO_VALIDACAO: data.codigoValidacao,
      NOME_RESPONSAVEL: data.modelo.nomeAssinante,
      CARGO_RESPONSAVEL: data.modelo.cargoAssinante,
      NOME_RESPONSAVEL_2: data.modelo.nomeAssinante2 ?? '',
      CARGO_RESPONSAVEL_2: data.modelo.cargoAssinante2 ?? '',
    };

    return Object.entries(variables).reduce((acc, [tag, valor]) => {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return acc.replace(new RegExp(`{{\\s*${escapedTag}\\s*}}`, 'gi'), valor ?? '');
    }, texto);
  }

  private extrairElementosLayout(config: Record<string, unknown>): CertificadoPdfElement[] {
    if (!Array.isArray(config.elements)) return [];

    return (config.elements as unknown[])
      .filter((item): item is CertificadoPdfElement => !!item && typeof item === 'object' && !Array.isArray(item))
      .filter((item) => item.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  private quebrarTextoEmLinhas(texto: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    return texto
      .split(/\r?\n/)
      .flatMap((paragraph) => {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [''];

        const lines: string[] = [];
        let current = '';
        words.forEach((word) => {
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !current) {
            current = candidate;
            return;
          }
          lines.push(current);
          current = word;
        });
        if (current) lines.push(current);
        return lines;
      });
  }

  private xAlinhado(boxX: number, boxWidth: number, textWidth: number, align?: string): number {
    if (align === 'center') return boxX + Math.max(0, (boxWidth - textWidth) / 2);
    if (align === 'right') return boxX + Math.max(0, boxWidth - textWidth);
    return boxX;
  }

  // ── Carregamento de Fontes ─────────────────────────────────────────────────

  private bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }

  private caminhosFonteLocal(fontName: string): string[] {
    const fileName = FONT_FILE_NAMES[fontName];
    if (!fileName) return [];

    return [
      join(process.cwd(), 'assets', 'fonts', fileName),
      join(process.cwd(), 'src', 'assets', 'fonts', fileName),
      join(this.fontCacheDir, fileName),
    ];
  }

  private carregarFonteLocal(fontName: string): ArrayBuffer | null {
    const caminho = this.caminhosFonteLocal(fontName).find((candidate) => existsSync(candidate));
    if (!caminho) return null;

    try {
      return this.bufferToArrayBuffer(readFileSync(caminho));
    } catch (err: unknown) {
      this.logger.warn(`Falha ao ler fonte local "${fontName}": ${String(err)}`);
      return null;
    }
  }

  private salvarFonteNoCacheLocal(fontName: string, fontBytes: ArrayBuffer): void {
    const fileName = FONT_FILE_NAMES[fontName];
    if (!fileName) return;

    try {
      mkdirSync(this.fontCacheDir, { recursive: true });
      const destino = join(this.fontCacheDir, fileName);
      if (!existsSync(destino)) {
        writeFileSync(destino, Buffer.from(fontBytes));
      }
    } catch (err: unknown) {
      this.logger.warn(`Falha ao salvar cache local da fonte "${fontName}": ${String(err)}`);
    }
  }

  private async carregarFonte(pdfDoc: PDFDocument, fontName?: string): Promise<PDFFont> {
    if (!fontName || fontName === 'Helvetica') return pdfDoc.embedFont(StandardFonts.Helvetica);
    if (fontName === 'TimesRoman') return pdfDoc.embedFont(StandardFonts.TimesRoman);
    if (fontName === 'Courier') return pdfDoc.embedFont(StandardFonts.Courier);

    const fontUrl = FONTS_URLS[fontName];
    if (!fontUrl) {
      this.logger.warn(`Fonte "${fontName}" não encontrada no catálogo. Usando Helvetica.`);
      return pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    try {
      pdfDoc.registerFontkit(fontkit);

      let fontBytes = this.fontCache.get(fontName);
      if (!fontBytes) {
        fontBytes = this.carregarFonteLocal(fontName) ?? undefined;
      }

      if (!fontBytes) {
        // Fontes vêm do catálogo hardcoded — allowlist de font hosts
        const safeUrl = this.sanitizeSafeUrl(fontUrl, ALLOWED_FONT_HOSTS);
        const res = await fetch(safeUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar fonte "${fontName}"`);

        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          throw new Error(`URL devolveu HTML (não é um .ttf): ${fontUrl}`);
        }
        fontBytes = await res.arrayBuffer();
        this.salvarFonteNoCacheLocal(fontName, fontBytes);
      }
      this.fontCache.set(fontName, fontBytes);
      return pdfDoc.embedFont(fontBytes);
    } catch (err: unknown) {
      this.logger.error(`Falha ao carregar fonte "${fontName}": ${String(err)}. Usando Helvetica.`);
      return pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  }

  // ── Renderizadores de Elementos ────────────────────────────────────────────

  private async adicionarArteBase(
    pdfDoc: PDFDocument,
    arteBaseUrl: string,
  ): Promise<{ page: PDFPage; width: number; height: number }> {
    const safeArteUrl = this.sanitizeSafeUrl(arteBaseUrl);
    const arteRes = await fetch(safeArteUrl);
    const arteBytes = await arteRes.arrayBuffer();
    const isPng = arteBaseUrl.toLowerCase().endsWith('.png');
    const background = isPng ? await pdfDoc.embedPng(arteBytes) : await pdfDoc.embedJpg(arteBytes);

    const { width, height } = background.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(background, { x: 0, y: 0, width, height });

    return { page, width, height };
  }

  private async desenharCorpoTexto(
    pdfDoc: PDFDocument,
    page: PDFPage,
    width: number,
    height: number,
    config: Record<string, unknown>,
    textoFormatado: string,
  ): Promise<void> {
    const textConf = (config.textoPronto as Record<string, unknown>) || {};
    const tXPct = (textConf.x as number) ?? 10;
    const tYPct = (textConf.y as number) ?? 20;
    const tX = (tXPct / 100) * width;
    const tMaxW = textConf.maxWidth ? ((textConf.maxWidth as number) / 100) * width : width - tX - 50;

    const tSize = (((textConf.fontSize as number) || 32) / CANVAS_REF_W) * width;
    const tY = topPctToY(tYPct, height, tSize);
    const fontCorpo = await this.carregarFonte(pdfDoc, textConf.fontFamily as string);
    const [r, g, b] = this.extrairRgb(textConf.color as string);

    page.drawText(textoFormatado, {
      x: tX,
      y: tY,
      size: tSize,
      font: fontCorpo,
      color: rgb(r, g, b),
      maxWidth: tMaxW,
      lineHeight: tSize * 1.4,
    });
  }

  private async desenharNomeAluno(
    pdfDoc: PDFDocument,
    page: PDFPage,
    width: number,
    height: number,
    config: Record<string, unknown>,
    nomeAluno: string,
  ): Promise<void> {
    const naConf = config.nomeAluno as Record<string, unknown> | undefined;
    if (!naConf) return;

    const naX = ((naConf.x as number) / 100) * width;
    const naSize = (((naConf.fontSize as number) || 56) / CANVAS_REF_W) * width;
    const naY = topPctToY(naConf.y as number, height, naSize);

    const fontNome = await this.carregarFonte(pdfDoc, naConf.fontFamily as string);
    const [naR, naG, naB] = this.extrairRgb(naConf.color as string);

    page.drawText(nomeAluno, {
      x: naX,
      y: naY,
      size: naSize,
      font: fontNome,
      color: rgb(naR, naG, naB),
      maxWidth: (((naConf.maxWidth as number) || 80) / 100) * width,
    });
  }

  private async injetarAssinaturaUrl(
    pc: PageCtx,
    width: number,
    height: number,
    signatureUrl: string,
    ctx: AssinaturaContext,
    isSecondary: boolean,
  ): Promise<void> {
    const safeUrl = this.sanitizeSafeUrl(signatureUrl);
    const res = await fetch(safeUrl);
    if (!res.ok) return;

    const imgBytes = await res.arrayBuffer();
    const isPng = safeUrl.toLowerCase().endsWith('.png');
    const image = isPng ? await pc.pdfDoc.embedPng(imgBytes) : await pc.pdfDoc.embedJpg(imgBytes);

    const conf = ctx.config;
    // Extraído de nested ternary — SonarQube: Extract this nested ternary operation
    const defaultXPrimaria = ctx.assinaturaUrl2 ? 20 : 40;
    const defaultX = isSecondary ? 60 : defaultXPrimaria;
    const defaultWpct = isSecondary ? ((ctx.assinatura1?.width as number) ?? 20) : 20;
    const wpct = (conf.width as number) || defaultWpct;
    const drawW = (wpct / 100) * width;
    const xpct = (conf.x as number) ?? defaultX;
    const yTopPct = (conf.y as number) ?? 70;

    const maxSigH = (80 / CANVAS_REF_H) * height;
    const sigGap = (4 / CANVAS_REF_H) * height;
    const sigNmSz = (11 / CANVAS_REF_W) * width;
    const sigCgSz = (9 / CANVAS_REF_W) * width;

    const rawAssH = image.height * (drawW / image.width);
    const finalH = Math.min(rawAssH, maxSigH);
    const finalW = finalH * (image.width / image.height);
    const posX = (xpct / 100) * width;
    const imgX = posX + (drawW - finalW) / 2;
    const posY = topPctToY(yTopPct, height, maxSigH);

    pc.page.drawImage(image, { x: imgX, y: posY + (maxSigH - finalH), width: finalW, height: finalH });

    const lineY = posY - sigGap;
    pc.page.drawLine({
      start: { x: posX, y: lineY },
      end: { x: posX + drawW, y: lineY },
      thickness: Math.max(0.5, width * 0.0003),
      color: rgb(0.35, 0.29, 0),
    });

    if (ctx.nome) {
      const nW = pc.fontBold.widthOfTextAtSize(ctx.nome, sigNmSz);
      pc.page.drawText(ctx.nome, {
        x: posX + (drawW - nW) / 2,
        y: lineY - sigNmSz * 1.3,
        size: sigNmSz,
        font: pc.fontBold,
        color: rgb(0, 0, 0),
      });
    }
    if (ctx.cargo) {
      const cW = pc.font.widthOfTextAtSize(ctx.cargo, sigCgSz);
      pc.page.drawText(ctx.cargo, {
        x: posX + (drawW - cW) / 2,
        y: lineY - sigNmSz * 1.3 - sigCgSz * 1.5,
        size: sigCgSz,
        font: pc.font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  private async desenharQrCode(
    pdfDoc: PDFDocument,
    page: PDFPage,
    width: number,
    height: number,
    qrConf: Record<string, unknown> | undefined,
    codigoValidacao: string,
  ): Promise<void> {
    const qrXPct = (qrConf?.x as number) ?? 85;
    const qrYPct = (qrConf?.y as number) ?? 85;
    const qrW = (((qrConf?.size as number) || 10) / 100) * width;
    const qrX = (qrXPct / 100) * width;
    const qrY = topPctToY(qrYPct, height, qrW);

    // frontendUrl resolvido em startup via ConfigService — sem require('dotenv') em prod
    const linkValidacao = `${this.frontendUrl}/validar-certificado?codigo=${codigoValidacao}`;
    const qrCodeDataUrl = await QRCode.toDataURL(linkValidacao, {
      margin: 1,
      width: 150,
      color: { dark: '#000', light: '#FFF' },
    });
    const qrBytes = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    const qrImage = await pdfDoc.embedPng(qrBytes);
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrW, height: qrW });
  }

  private async desenharElementoTexto(
    pc: PageCtx,
    pageWidth: number,
    pageHeight: number,
    element: CertificadoPdfElement,
    data: PdfRenderData,
  ): Promise<void> {
    const content = element.type === 'VALIDATION_CODE'
      ? (element.content || '{{CODIGO_CERTIFICADO}}')
      : (element.content || '');
    const texto = this.normalizarTextoVariavel(content, data);
    if (!texto) return;

    const font = element.fontWeight === 'bold'
      ? pc.fontBold
      : await this.carregarFonte(pc.pdfDoc, element.fontFamily);
    const fontSize = this.tamanhoFontePdf(element.fontSize, pageWidth);
    const lineHeight = fontSize * (element.lineHeight ?? 1.4);
    const boxX = this.pctToX(element.x, pageWidth);
    const boxTopY = pageHeight - (((element.y ?? 0) / 100) * pageHeight);
    const boxWidth = this.pctToWidth(element.width, pageWidth, 40);
    const boxHeight = this.pctToHeight(element.height, pageHeight, 10);
    const [r, g, b] = this.extrairRgb(element.color);
    const lines = this.quebrarTextoEmLinhas(texto, font, fontSize, boxWidth);
    const maxLines = Math.max(1, Math.floor(boxHeight / lineHeight));

    lines.slice(0, maxLines).forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const x = this.xAlinhado(boxX, boxWidth, textWidth, element.textAlign);
      const y = boxTopY - fontSize - (index * lineHeight);
      pc.page.drawText(line, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
      });
    });
  }

  private async desenharElementoQrCode(
    pc: PageCtx,
    pageWidth: number,
    pageHeight: number,
    element: CertificadoPdfElement,
    codigoValidacao: string,
  ): Promise<void> {
    await this.desenharQrCode(
      pc.pdfDoc,
      pc.page,
      pageWidth,
      pageHeight,
      { x: element.x, y: element.y, size: element.width ?? element.height },
      codigoValidacao,
    );
  }

  private desenharElementoLinha(
    page: PDFPage,
    pageWidth: number,
    pageHeight: number,
    element: CertificadoPdfElement,
  ): void {
    const x = this.pctToX(element.x, pageWidth);
    const y = topPctToY(element.y ?? 0, pageHeight);
    const lineWidth = this.pctToWidth(element.width, pageWidth, 20);
    const thickness = Math.max(0.5, this.pctToHeight(element.height, pageHeight, 0.2));
    const [r, g, b] = this.extrairRgb(element.color);

    page.drawLine({
      start: { x, y },
      end: { x: x + lineWidth, y },
      thickness,
      color: rgb(r, g, b),
    });
  }

  private async desenharElementoAssinatura(
    pc: PageCtx,
    pageWidth: number,
    pageHeight: number,
    element: CertificadoPdfElement,
    data: PdfRenderData,
  ): Promise<void> {
    const isSecondary = element.legacyField === 'assinatura2';
    const signatureUrl = isSecondary ? data.modelo.assinaturaUrl2 : data.modelo.assinaturaUrl;
    const nome = isSecondary ? data.modelo.nomeAssinante2 : data.modelo.nomeAssinante;
    const cargo = isSecondary ? data.modelo.cargoAssinante2 : data.modelo.cargoAssinante;

    if (signatureUrl) {
      await this.injetarAssinaturaUrl(
        pc,
        pageWidth,
        pageHeight,
        signatureUrl,
        {
          config: {
            x: element.x,
            y: element.y,
            width: element.width,
          },
          nome,
          cargo,
          assinaturaUrl2: data.modelo.assinaturaUrl2,
          assinatura1: { width: element.width },
        },
        isSecondary,
      );
      return;
    }

    if (element.legacyField) return;

    const x = this.pctToX(element.x, pageWidth);
    const y = topPctToY(element.y ?? 0, pageHeight);
    const boxWidth = this.pctToWidth(element.width, pageWidth, 30);
    const fontSize = this.tamanhoFontePdf(element.fontSize, pageWidth, 12);
    const texto = this.normalizarTextoVariavel(element.content || '{{NOME_RESPONSAVEL}}\n{{CARGO_RESPONSAVEL}}', data);

    pc.page.drawLine({
      start: { x, y },
      end: { x: x + boxWidth, y },
      thickness: Math.max(0.5, pageWidth * 0.0003),
      color: rgb(0.35, 0.29, 0),
    });

    texto.split(/\r?\n/).forEach((line, index) => {
      const textWidth = pc.font.widthOfTextAtSize(line, fontSize);
      pc.page.drawText(line, {
        x: this.xAlinhado(x, boxWidth, textWidth, 'center'),
        y: y - fontSize * (1.4 + index),
        size: fontSize,
        font: pc.font,
        color: rgb(0, 0, 0),
      });
    });
  }

  private async desenharElementoImagemAssinatura(
    pc: PageCtx,
    pageWidth: number,
    pageHeight: number,
    element: CertificadoPdfElement,
  ): Promise<void> {
    if (!element.content) return;

    const safeUrl = this.sanitizeSafeUrl(element.content);
    const res = await fetch(safeUrl);
    if (!res.ok) return;

    const imgBytes = await res.arrayBuffer();
    const isPng = safeUrl.toLowerCase().endsWith('.png');
    const image = isPng ? await pc.pdfDoc.embedPng(imgBytes) : await pc.pdfDoc.embedJpg(imgBytes);
    const drawW = this.pctToWidth(element.width, pageWidth, 20);
    const drawH = this.pctToHeight(element.height, pageHeight, 8);
    const x = this.pctToX(element.x, pageWidth);
    const y = topPctToY(element.y ?? 0, pageHeight, drawH);

    pc.page.drawImage(image, { x, y, width: drawW, height: drawH });
  }

  private async desenharElementosDinamicos(
    pc: PageCtx,
    pageWidth: number,
    pageHeight: number,
    elements: CertificadoPdfElement[],
    data: PdfRenderData,
  ): Promise<void> {
    for (const element of elements) {
      switch (element.type) {
        case 'TEXT':
        case 'DYNAMIC_TEXT':
        case 'VALIDATION_CODE':
          await this.desenharElementoTexto(pc, pageWidth, pageHeight, element, data);
          break;
        case 'QR_CODE':
          await this.desenharElementoQrCode(pc, pageWidth, pageHeight, element, data.codigoValidacao);
          break;
        case 'SIGNATURE_BLOCK':
          await this.desenharElementoAssinatura(pc, pageWidth, pageHeight, element, data);
          break;
        case 'SIGNATURE_IMAGE':
          await this.desenharElementoImagemAssinatura(pc, pageWidth, pageHeight, element);
          break;
        case 'LINE':
          this.desenharElementoLinha(pc.page, pageWidth, pageHeight, element);
          break;
        default:
          this.logger.warn(`Tipo de elemento PDF nao suportado: ${String(element.type)}`);
          break;
      }
    }
  }

  private async desenharLayoutLegado(
    pc: PageCtx,
    width: number,
    height: number,
    config: Record<string, unknown>,
    data: PdfRenderData,
  ): Promise<void> {
    await this.desenharCorpoTexto(pc.pdfDoc, pc.page, width, height, config, data.textoFormatado);

    if (data.nomeAluno) {
      await this.desenharNomeAluno(pc.pdfDoc, pc.page, width, height, config, data.nomeAluno);
    }

    const assinatura1Conf = (config.assinatura1 as Record<string, unknown> | undefined) ?? {};
    const assinatura2Conf = (config.assinatura2 as Record<string, unknown> | undefined) ?? {};

    if (data.modelo.assinaturaUrl) {
      await this.injetarAssinaturaUrl(
        pc,
        width,
        height,
        data.modelo.assinaturaUrl,
        {
          config: assinatura1Conf,
          nome: data.modelo.nomeAssinante,
          cargo: data.modelo.cargoAssinante,
          assinaturaUrl2: data.modelo.assinaturaUrl2,
          assinatura1: assinatura1Conf,
        },
        false,
      );
    }

    if (data.modelo.assinaturaUrl2) {
      await this.injetarAssinaturaUrl(
        pc,
        width,
        height,
        data.modelo.assinaturaUrl2,
        {
          config: assinatura2Conf,
          nome: data.modelo.nomeAssinante2,
          cargo: data.modelo.cargoAssinante2,
          assinaturaUrl2: data.modelo.assinaturaUrl2,
          assinatura1: assinatura1Conf,
        },
        true,
      );
    }

    await this.desenharQrCode(
      pc.pdfDoc,
      pc.page,
      width,
      height,
      config.qrCode as Record<string, unknown> | undefined,
      data.codigoValidacao,
    );
  }

  // ── Engine Principal ───────────────────────────────────────────────────────

  async construirPdfBase(
    modelo: ModeloPdf,
    textoFormatado: string,
    codigoValidacao: string,
    nomeAluno?: string,
    variables: Record<string, string> = {},
  ): Promise<Buffer> {
    try {
      const { arteBaseUrl, layoutConfig } = modelo;
      const config = layoutConfig && typeof layoutConfig === 'object' && !Array.isArray(layoutConfig)
        ? (layoutConfig as Record<string, unknown>)
        : {};
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const { page, width, height } = await this.adicionarArteBase(pdfDoc, arteBaseUrl);
      const pc: PageCtx = { pdfDoc, page, font, fontBold };
      const renderData: PdfRenderData = { textoFormatado, codigoValidacao, nomeAluno, variables, modelo };
      const elements = this.extrairElementosLayout(config);

      if (elements.length > 0) {
        await this.desenharElementosDinamicos(pc, width, height, elements, renderData);
      } else {
        await this.desenharLayoutLegado(pc, width, height, config, renderData);
      }

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error: unknown) {
      this.logger.error(`Falha no Engine PDF: ${String(error)}`);
      throw new InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.');
    }
  }
}
