import { Module } from '@nestjs/common';
import { ApoiadoresController } from './apoiadores.controller';
import { ApoiadoresService } from './apoiadores.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../../upload/upload.module';
import { CertificadosModule } from '../../certificados/certificados.module';

@Module({
  imports: [PrismaModule, UploadModule, CertificadosModule],
  controllers: [ApoiadoresController],
  providers: [ApoiadoresService],
})
export class ApoiadoresModule {}
