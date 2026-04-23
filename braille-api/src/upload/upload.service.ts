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

  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    // 👇 A configuração do Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  uploadImage(file: Express.Multer.File, auditUser?: AuditUser): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      // Validação extra de segurança: aceitar imagens e PDFs (Laudos)
      const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(file.mimetype)) {
        return reject(new BadRequestException('Apenas arquivos de imagem ou PDF são permitidos.'));
      }

      const isPdf = file.mimetype === 'application/pdf';

      // PDFs não suportam transformações de qualidade/formato do Cloudinary
      const uploadOptions = isPdf
        ? { folder: 'braille_instituicao', resource_type: 'auto' as const }
        : {
            folder: 'braille_instituicao',
            resource_type: 'image' as const,
            transformation: [
              { fetch_format: 'auto', quality: 'auto' }, // Otimização Cloudinary LCP Permanente (UX/Performance)
            ],
          };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            // Detecta o erro de tamanho do plano gratuito do Cloudinary
            if (error.message?.includes('File size too large') || error.message?.includes('Maximum is')) {
              return reject(
                new BadRequestException(
                  'Arquivo muito grande. O tamanho máximo permitido é 10 MB. Comprima o arquivo e tente novamente.',
                ),
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
        },
      );

      // Pega o arquivo da memória do servidor e joga para o Cloudinary
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

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

      // Imagens recebem compressão automática do Cloudinary; PDFs são armazenados como 'auto'
      const uploadOptions = isImage
        ? {
            folder,
            resource_type: 'image' as const,
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }, // Cloudinary otimiza qualidade e formato
            ],
            use_filename: true,
            unique_filename: true,
          }
        : {
            folder,
            resource_type: 'auto' as const,
            use_filename: true,
            unique_filename: true,
          };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            if (error.message?.includes('File size too large') || error.message?.includes('Maximum is')) {
              return reject(
                new BadRequestException(
                  'Arquivo muito grande. O tamanho máximo permitido é 10 MB. Comprima o arquivo e tente novamente.',
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
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Faz upload de um PDF gerado em memória (Buffer) sem depências do Multer.
   * Usado para persistir certificados gerados dinamicamente no Cloudinary.
   */
  uploadPdfBuffer(buffer: Buffer, fileName: string, folder = 'braille_certificados'): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw', // 'raw' para PDFs (download direto)
          public_id: fileName.replace(/\.pdf$/i, ''),
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
      // Exemplo de URL: https://res.cloudinary.com/cloud_name/image/upload/v123456789/braille_instituicao/nome_do_arquivo.jpg
      // Precisamos extrair 'braille_instituicao/nome_do_arquivo'
      const urlParts = fileUrl.split('/');
      const filenameWithExtension = urlParts.at(-1); // nome_do_arquivo.jpg
      const folder = urlParts.at(-2); // braille_instituicao

      if (!filenameWithExtension || !folder) {
        throw new BadRequestException('URL do Cloudinary inválida.');
      }

      // Remover a extensão (.jpg, .png, .pdf)
      const filename = filenameWithExtension.split('.')[0];
      const publicId = `${folder}/${filename}`;

      // Determinar o tipo do arquivo (necessário para apagar corretamente)
      const resourceType = fileUrl.toLowerCase().includes('.pdf') ? 'raw' : 'image';

      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Falha ao excluir no Cloudinary: ${result.result}`);
      }

      if (auditUser) {
        this.auditLogService
          .registrar({
            entidade: 'Cloudinary_System',
            registroId: publicId,
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
