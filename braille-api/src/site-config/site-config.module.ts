import { Module } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SiteConfigController } from './site-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [SiteConfigController],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
