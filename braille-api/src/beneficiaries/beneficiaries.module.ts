import { Module } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [AuditLogModule, UploadModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
})
export class BeneficiariesModule { }
