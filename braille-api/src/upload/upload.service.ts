import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { AuditAcao, Role } from '@prisma/client';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private static readonly cloudinaryMaxFileSize = 10 * 1024 * 1024;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  private validarTamanhoArquivo(bytes: number, tipo: 'arquivo' | 'pdf' | 'imagem' = 'arquivo'): void {
    if (bytes <= UploadService.cloudinaryMaxFileSize) return;

    const tipoFormatado = tipo === 'pdf' ? 'PDF' : tipo === 'imagem' ? 'Imagem' : 'Arquivo';
    throw new BadRequestException(`${tipoFormatado} muito grande. O tamanho máximo é 10 MB.`);
  }

  private validarTamanhoMulter(file: Express.Multer.File, tipo: 'arquivo' | 'pdf' | 'imagem' = 'arquivo'): void {
    this.validarTamanhoArquivo(Math.max(file.size ?? 0, file.buffer?.length ?? 0), tipo);
  }

  private extrairPublicIdsCloudinary(fileUrl: string): string[] {
    const rawValue = fileUrl.trim();
    if (!rawValue) throw new BadRequestException('A URL do arquivo é obrigatória.');

    const publicIdComExt = this.extrairPublicIdDeUrl(rawValue) ?? rawValue.replace(/^\/+|\/+$/g, '');
    const publicIdSemExt = publicIdComExt.replace(/\.[^/.]+$/, '');

    return Array.from(new Set([publicIdComExt, publicIdSemExt].filter(Boolean)));
  }

  private extrairPublicIdDeUrl(fileUrl: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex < 0) throw new BadRequestException('URL do Cloudinary inválida.');

    const afterUpload = parts.slice(uploadIndex + 1);
    const versionIndex = afterUpload.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts = versionIndex >= 0 ? afterUpload.slice(versionIndex + 1) : afterUpload;

    if (publicIdParts.length === 0) throw new BadRequestException('URL do Cloudinary inválida.');
    return decodeURIComponent(publicIdParts.join('/'));
  }

  private tiposDeletePorArquivo(fileUrl: string): Array<'image' | 'raw'> {
    const lowerUrl = fileUrl.toLowerCase();
    if (lowerUrl.includes('/raw/upload/')) return ['raw', 'image'];
    if (lowerUrl.includes('/image/upload/')) return ['image', 'raw'];
    if (lowerUrl.endsWith('.pdf')) return ['raw', 'image'];
    return ['image', 'raw'];
  }

  // ─── Upload de Imagem ou PDF (foto perfil / laudo como imagem) ─────────────
  uploadImage(file: Express.Multer.File, auditUser?: AuditUser): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(file.mimetype)) {
        return reject(new BadRequestException('Apenas imagens (JPG/PNG/WebP) ou PDF são permitidos.'));
      }

      const isPdf = file.mimetype === 'application/pdf';
      try {
        this.validarTamanhoMulter(file, isPdf ? 'pdf' : 'imagem');
      } catch (error) {
        return reject(error);
      }

      // PDFs não suportam transformation de qualidade — apenas resource_type:auto
      const uploadOptions = isPdf
        ? { folder: 'braille_instituicao', resource_type: 'auto' as const }
        : {
            folder: 'braille_instituicao',
            resource_type: 'image' as const,
            transformation: [
              { fetch_format: 'auto', quality: 'auto' }, // Cloudinary otimiza formato e qualidade
            ],
          };

      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          if (error.message?.includes('File size too large') || error.message?.includes('Maximum is')) {
            return reject(
              new BadRequestException('Arquivo muito grande. O tamanho máximo é 10 MB.'),
            );
          }
          return reject(new Error(error.message || 'Erro no Cloudinary'));
        }

        if (!result) return reject(new BadRequestException('Erro desconhecido ao enviar imagem.'));

        if (auditUser) {
          this.auditLogService
            .registrar({
              entidade: 'Cloudinary_System',
              registroId: result.public_id,
              acao: AuditAcao.CRIAR,
              autorId: auditUser.sub,
              autorNome: auditUser.nome,
              autorRole: auditUser.role,
              ip: auditUser.ip,
              userAgent: auditUser.userAgent,
              newValue: { url: result.secure_url, folder: 'braille_instituicao' },
            })
            .catch((e) => this.logger.warn(`Failure auditing Cloudinary Upload: ${e.message}`));
        }

        resolve({ url: result.secure_url });
      });

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // ─── Upload de PDF ou Imagem (Laudo Médico / Termo LGPD / Atestado) ────────
  uploadPdf(
    file: Express.Multer.File,
    folder: 'braille_lgpd' | 'braille_atestados' | 'braille_laudos',
    auditUser?: AuditUser,
  ): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const isImage = file.mimetype.startsWith('image/');
      const isPdf = file.mimetype === 'application/pdf';

      if (!isImage && !isPdf) {
        return reject(new BadRequestException('Apenas arquivos PDF ou imagens são permitidos.'));
      }

      try {
        this.validarTamanhoMulter(file, isPdf ? 'pdf' : 'imagem');
      } catch (error) {
        return reject(error);
      }

      // Imagens: Cloudinary otimiza automaticamente; PDFs: resource_type auto
      const uploadOptions = isImage
        ? {
            folder,
            resource_type: 'image' as const,
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            use_filename: true,
            unique_filename: true,
          }
        : {
            folder,
            resource_type: 'auto' as const,
            use_filename: true,
            unique_filename: true,
          };

      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          if (error.message?.includes('File size too large') || error.message?.includes('Maximum is')) {
            return reject(
              new BadRequestException(
                isPdf
                  ? 'PDF muito grande. O tamanho máximo é 10 MB. Comprima o PDF e tente novamente.'
                  : 'Imagem muito grande. O tamanho máximo é 10 MB.',
              ),
            );
          }
          return reject(new Error(error.message || 'Erro no Cloudinary'));
        }

        if (!result) return reject(new BadRequestException('Erro desconhecido ao enviar arquivo.'));

        if (auditUser) {
          this.auditLogService
            .registrar({
              entidade: 'Cloudinary_System',
              registroId: result.public_id,
              acao: AuditAcao.CRIAR,
              autorId: auditUser.sub,
              autorNome: auditUser.nome,
              autorRole: auditUser.role,
              ip: auditUser.ip,
              userAgent: auditUser.userAgent,
              newValue: { url: result.secure_url, folder },
            })
            .catch((e) => this.logger.warn(`Failure auditing Cloudinary Pdf Upload: ${e.message}`));
        }

        resolve({ url: result.secure_url });
      });

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Faz upload de um PDF gerado em memória (Buffer) sem dependências do Multer.
   * Usado para persistir certificados gerados dinamicamente no Cloudinary.
   */
  uploadPdfBuffer(buffer: Buffer, fileName: string, folder = 'braille_certificados'): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      try {
        this.validarTamanhoArquivo(buffer.length, 'pdf');
      } catch (error) {
        return reject(error);
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw',
          // O Cloudinary requer a extensão para arquivos raw, caso contrário serve como octet-stream (forçando download)
          public_id: fileName.replace(/\.pdf$/i, '') + '.pdf',
          use_filename: false,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(new Error(error.message || 'Erro no Cloudinary'));
          if (!result) return reject(new BadRequestException('Erro ao enviar PDF para o Cloudinary.'));
          resolve({ url: result.secure_url });
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async deleteFile(fileUrl: string, auditUser?: AuditUser): Promise<{ success: boolean; message: string }> {
    if (!fileUrl) {
      throw new BadRequestException('A URL do arquivo é obrigatória.');
    }

    try {
      const publicIds = this.extrairPublicIdsCloudinary(fileUrl);
      const resourceTypes = this.tiposDeletePorArquivo(fileUrl);
      let publicIdAuditado = publicIds[0];
      let arquivoNaoEncontrado = false;

      for (const resourceType of resourceTypes) {
        for (const publicId of publicIds) {
          const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

          if (result.result === 'ok') {
            publicIdAuditado = publicId;
            arquivoNaoEncontrado = false;
            break;
          }

          if (result.result === 'not found') {
            arquivoNaoEncontrado = true;
            continue;
          }

          throw new Error(`Falha ao excluir no Cloudinary: ${result.result}`);
        }

        if (!arquivoNaoEncontrado) break;
      }

      if (auditUser) {
        this.auditLogService
          .registrar({
            entidade: 'Cloudinary_System',
            registroId: publicIdAuditado,
            acao: AuditAcao.EXCLUIR,
            autorId: auditUser.sub,
            autorNome: auditUser.nome,
            autorRole: auditUser.role,
            ip: auditUser.ip,
            userAgent: auditUser.userAgent,
            oldValue: { url: fileUrl },
          })
          .catch((e) => this.logger.warn(`Failure auditing Cloudinary Delete: ${e.message}`));
      }

      return { success: true, message: 'Arquivo excluído com sucesso.' };
    } catch (error) {
      this.logger.error(`Tentativa falha de exclusão na nuvem (Url: ${fileUrl}):`, error);
      throw new BadRequestException('Não foi possível excluir o arquivo na nuvem.');
    }
  }
}
