import { Module } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { ComunicadosController } from './comunicados.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [AuditLogModule, UploadModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule { }
