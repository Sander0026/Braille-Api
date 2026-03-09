import { Module } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
})
export class BeneficiariesModule { }
