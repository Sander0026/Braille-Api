import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AlunoLinhaTempoModule } from '../aluno-linha-tempo/aluno-linha-tempo.module';
import { PdiController } from './pdi.controller';
import { PdiService } from './pdi.service';

@Module({
  imports: [AuditLogModule, AlunoLinhaTempoModule],
  controllers: [PdiController],
  providers: [PdiService],
})
export class PdiModule {}
