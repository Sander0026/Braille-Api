import { Module } from '@nestjs/common';
import { CertificadosService } from './certificados.service';
import { CertificadosController } from './certificados.controller';
import { CertificadosPublicoController } from './certificados-publico.controller';
import { UploadModule } from '../upload/upload.module';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { ImageProcessingService } from './image-processing.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [UploadModule, AuditLogModule],
  controllers: [CertificadosController, CertificadosPublicoController],
  providers: [CertificadosService, PrismaService, PdfService, ImageProcessingService],
  exports: [PdfService],
})
export class CertificadosModule {}
