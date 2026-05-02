import { Module } from '@nestjs/common';
import { TurmasService } from './turmas.service';
import { TurmasController } from './turmas.controller';
import { TurmasScheduler } from './turmas.scheduler';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [TurmasController],
  providers: [TurmasService, TurmasScheduler],
})
export class TurmasModule {}
