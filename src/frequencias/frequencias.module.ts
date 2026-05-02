import { Module } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { FrequenciasController } from './frequencias.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuditLogModule, ConfigModule],
  controllers: [FrequenciasController],
  providers: [FrequenciasService],
})
export class FrequenciasModule {}
