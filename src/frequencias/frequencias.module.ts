import { Module } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { FrequenciasController } from './frequencias.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ConfigModule } from '@nestjs/config';
import { AlunoLinhaTempoModule } from '../aluno-linha-tempo/aluno-linha-tempo.module';
import { FrequenciaPdfService } from './exporters/frequencia-pdf.service';

@Module({
  imports: [AuditLogModule, ConfigModule, AlunoLinhaTempoModule],
  controllers: [FrequenciasController],
  providers: [FrequenciasService, FrequenciaPdfService],
})
export class FrequenciasModule {}
