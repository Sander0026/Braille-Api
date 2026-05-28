import { Module } from '@nestjs/common';
import { LaudosService } from './laudos.service';
import { LaudosController } from './laudos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AlunoLinhaTempoModule } from '../aluno-linha-tempo/aluno-linha-tempo.module';

@Module({
  imports: [PrismaModule, AuditLogModule, AlunoLinhaTempoModule],
  controllers: [LaudosController],
  providers: [LaudosService],
  exports: [LaudosService],
})
export class LaudosModule {}
