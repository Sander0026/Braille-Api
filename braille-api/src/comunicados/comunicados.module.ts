import { Module } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { ComunicadosController } from './comunicados.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule { }
