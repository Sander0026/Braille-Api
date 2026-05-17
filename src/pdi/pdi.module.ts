import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PdiController } from './pdi.controller';
import { PdiService } from './pdi.service';

@Module({
  imports: [AuditLogModule],
  controllers: [PdiController],
  providers: [PdiService],
})
export class PdiModule {}
