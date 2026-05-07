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
    const hex = hexColor.replace('#', '');
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255;
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255;
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
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

    const fontNome = await this.carregarFonte(pdfDoc, naConf.fontFamily as string);
    const [naR, naG, naB] = this.extrairRgb(naConf.color as string);
    const nomeLinhaUnica = nomeAluno.replace(/\s+/g, ' ').trim();
    if (!nomeLinhaUnica) return;

    const palavras = nomeLinhaUnica.split(' ');
    const naX = (((naConf.x as number) ?? 10) / 100) * width;
    const naMaxW = Math.max(1, Math.min(((((naConf.maxWidth as number) || 80) / 100) * width), width - naX));
    const larguraNome = (size: number): number => {
      const espacoEntrePalavras = size * 0.28;
      const larguraPalavras = palavras.reduce((total, palavra) => total + fontNome.widthOfTextAtSize(palavra, size), 0);
      return larguraPalavras + espacoEntrePalavras * Math.max(0, palavras.length - 1);
    };

    const tamanhoBase = (((naConf.fontSize as number) || 56) / CANVAS_REF_W) * width;
    const larguraBase = larguraNome(tamanhoBase);
    const naSize = larguraBase > naMaxW ? Math.max(tamanhoBase * 0.45, tamanhoBase * (naMaxW / larguraBase)) : tamanhoBase;
    const larguraFinal = larguraNome(naSize);
    const alinhamento = naConf.textAlign as string | undefined;
    const ajusteX =
      alinhamento === 'center'
        ? Math.max(0, (naMaxW - larguraFinal) / 2)
        : alinhamento === 'right'
          ? Math.max(0, naMaxW - larguraFinal)
          : 0;
    const naY = topPctToY((naConf.y as number) ?? 45, height, naSize);

    let cursorX = naX + ajusteX;
    const espacoEntrePalavras = naSize * 0.28;
    palavras.forEach((palavra) => {
      page.drawText(palavra, {
        x: cursorX,
        y: naY,
        size: naSize,
        font: fontNome,
        color: rgb(naR, naG, naB),
      });
      cursorX += fontNome.widthOfTextAtSize(palavra, naSize) + espacoEntrePalavras;
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

  // ── Engine Principal ───────────────────────────────────────────────────────

  async construirPdfBase(
    modelo: ModeloPdf,
    textoFormatado: string,
    codigoValidacao: string,
    nomeAluno?: string,
  ): Promise<Buffer> {
    try {
      const {
        arteBaseUrl,
        assinaturaUrl,
        assinaturaUrl2,
        layoutConfig,
        nomeAssinante,
        cargoAssinante,
        nomeAssinante2,
        cargoAssinante2,
      } = modelo;
      const config = (layoutConfig as Record<string, unknown>) || {};
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const { page, width, height } = await this.adicionarArteBase(pdfDoc, arteBaseUrl);
      const pc: PageCtx = { pdfDoc, page, font, fontBold };

      await this.desenharCorpoTexto(pdfDoc, page, width, height, config, textoFormatado);

      if (nomeAluno) {
        await this.desenharNomeAluno(pdfDoc, page, width, height, config, nomeAluno);
      }

      const assinatura1Conf = (config.assinatura1 as Record<string, unknown> | undefined) ?? {};
      const assinatura2Conf = (config.assinatura2 as Record<string, unknown> | undefined) ?? {};

      if (assinaturaUrl) {
        await this.injetarAssinaturaUrl(
          pc,
          width,
          height,
          assinaturaUrl,
          {
            config: assinatura1Conf,
            nome: nomeAssinante,
            cargo: cargoAssinante,
            assinaturaUrl2,
            assinatura1: assinatura1Conf,
          },
          false,
        );
      }

      if (assinaturaUrl2) {
        await this.injetarAssinaturaUrl(
          pc,
          width,
          height,
          assinaturaUrl2,
          {
            config: assinatura2Conf,
            nome: nomeAssinante2,
            cargo: cargoAssinante2,
            assinaturaUrl2,
            assinatura1: assinatura1Conf,
          },
          true,
        );
      }

      await this.desenharQrCode(
        pdfDoc,
        page,
        width,
        height,
        config.qrCode as Record<string, unknown> | undefined,
        codigoValidacao,
      );

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error: unknown) {
      this.logger.error(`Falha no Engine PDF: ${String(error)}`);
      throw new InternalServerErrorException('Problemas críticos ao montar o PDF das partes gráficas.');
    }
  }
}
