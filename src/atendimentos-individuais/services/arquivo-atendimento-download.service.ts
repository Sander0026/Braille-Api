import { BadGatewayException, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';

const STORAGE_DOWNLOAD_TIMEOUT_MS = 30_000;

export type ArquivoAtendimentoDownloadInfo = {
  stream: Readable;
  contentType: string;
  fileName: string;
  encodedFileName: string;
};

/** @deprecated Mantido para compatibilidade com testes existentes — será removido. */
export type ArquivoAtendimentoDownload = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  encodedFileName: string;
};

@Injectable()
export class ArquivoAtendimentoDownloadService {
  /**
   * Baixa o arquivo como stream, evitando carregar o conteúdo inteiro na memória.
   * Ideal para arquivos grandes (laudos médicos, relatórios PDF).
   */
  async baixarStream(arquivo: { url: string; nomeOriginal: string; tipoArquivo?: string | null }): Promise<ArquivoAtendimentoDownloadInfo> {
    this.validarUrlStorage(arquivo.url);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), STORAGE_DOWNLOAD_TIMEOUT_MS);
    let storageResponse: globalThis.Response;

    try {
      storageResponse = await fetch(arquivo.url, { signal: abortController.signal });
    } catch {
      throw new BadGatewayException('Nao foi possivel carregar o arquivo solicitado.');
    } finally {
      clearTimeout(timeout);
    }

    if (!storageResponse.ok) {
      throw new BadGatewayException('Nao foi possivel carregar o arquivo solicitado.');
    }

    const body = storageResponse.body;
    if (!body) {
      throw new BadGatewayException('Resposta do storage sem conteudo.');
    }

    const readable = Readable.fromWeb(body as any);

    return {
      stream: readable,
      contentType: arquivo.tipoArquivo || storageResponse.headers.get('content-type') || 'application/octet-stream',
      fileName: this.sanitizarNomeArquivo(arquivo.nomeOriginal),
      encodedFileName: encodeURIComponent(arquivo.nomeOriginal),
    };
  }

  /**
   * Fallback em buffer — mantido para compatibilidade.
   * Preferir `baixarStream` para novos usos.
   */
  async baixar(arquivo: { url: string; nomeOriginal: string; tipoArquivo?: string | null }): Promise<ArquivoAtendimentoDownload> {
    this.validarUrlStorage(arquivo.url);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), STORAGE_DOWNLOAD_TIMEOUT_MS);
    let storageResponse: globalThis.Response;

    try {
      storageResponse = await fetch(arquivo.url, { signal: abortController.signal });
    } catch {
      throw new BadGatewayException('Nao foi possivel carregar o arquivo solicitado.');
    } finally {
      clearTimeout(timeout);
    }

    if (!storageResponse.ok) {
      throw new BadGatewayException('Nao foi possivel carregar o arquivo solicitado.');
    }

    return {
      buffer: Buffer.from(await storageResponse.arrayBuffer()),
      contentType: arquivo.tipoArquivo || storageResponse.headers.get('content-type') || 'application/octet-stream',
      fileName: this.sanitizarNomeArquivo(arquivo.nomeOriginal),
      encodedFileName: encodeURIComponent(arquivo.nomeOriginal),
    };
  }

  private validarUrlStorage(url: string): void {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadGatewayException('URL do arquivo armazenado e invalida.');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new BadGatewayException('URL do arquivo armazenado nao e permitida.');
    }

    const allowedHosts = this.obterHostsStoragePermitidos();
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

    if (!isAllowed) {
      throw new BadGatewayException('Origem do arquivo armazenado nao e permitida.');
    }
  }

  private obterHostsStoragePermitidos(): string[] {
    return (process.env.ATENDIMENTOS_ARQUIVOS_ALLOWED_HOSTS || 'cloudinary.com')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }

  private sanitizarNomeArquivo(nome: string): string {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'arquivo-atendimento';
  }
}
