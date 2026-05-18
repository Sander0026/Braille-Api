import { Module } from '@nestjs/common';
import { TurmasService } from './turmas.service';
import { TurmasController } from './turmas.controller';
import { TurmasScheduler } from './turmas.scheduler';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AlunoLinhaTempoModule } from '../aluno-linha-tempo/aluno-linha-tempo.module';

@Module({
  imports: [AuditLogModule, AlunoLinhaTempoModule],
  controllers: [TurmasController],
  providers: [TurmasService, TurmasScheduler],
})
export class TurmasModule {}
