import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AuditLogController],
    providers: [AuditLogService],
    exports: [AuditLogService],   // Exporta para que outros módulos possam injetar
})
export class AuditLogModule { }
