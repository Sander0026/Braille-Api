import { Module } from '@nestjs/common';
import { AtestadosService } from './atestados.service';
import { AtestadosController } from './atestados.controller';
import { UploadModule } from '../upload/upload.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [UploadModule, AuditLogModule],
  controllers: [AtestadosController],
  providers: [AtestadosService],
  exports: [AtestadosService], // exportado para uso futuro no FrequenciasModule se necessário
})
export class AtestadosModule {}
