import { Module }                     from '@nestjs/common';
import { ConfigModule }               from '@nestjs/config';
import { CertificadosService }        from './certificados.service';
import { CertificadosController }     from './certificados.controller';
import { CertificadosPublicoController } from './certificados-publico.controller';
import { UploadModule }               from '../upload/upload.module';
import { PrismaService }              from '../prisma/prisma.service';
import { PdfService }                 from './pdf.service';
import { ImageProcessingService }     from './image-processing.service';
import { AuditLogModule }             from '../audit-log/audit-log.module';

@Module({
  // ConfigModule importado localmente para garantir ConfigService no PdfService
  // sem depender de isGlobal no AppModule.
  imports: [UploadModule, AuditLogModule, ConfigModule],
  controllers: [CertificadosController, CertificadosPublicoController],
  providers:   [CertificadosService, PrismaService, PdfService, ImageProcessingService],
  exports:     [PdfService],
})
export class CertificadosModule {}
