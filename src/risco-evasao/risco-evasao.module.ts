import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RiscoEvasaoController } from './risco-evasao.controller';
import { RiscoEvasaoService } from './risco-evasao.service';

@Module({
  imports: [AuditLogModule],
  controllers: [RiscoEvasaoController],
  providers: [RiscoEvasaoService],
})
export class RiscoEvasaoModule {}
