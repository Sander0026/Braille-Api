import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlunoLinhaTempoController } from './aluno-linha-tempo.controller';
import { AlunoLinhaTempoService } from './aluno-linha-tempo.service';
import { EventoLinhaTempoService } from './evento-linha-tempo.service';
import { LinhaTempoBackfillService } from './linha-tempo-backfill.service';

@Module({
  imports: [PrismaModule],
  controllers: [AlunoLinhaTempoController],
  providers: [AlunoLinhaTempoService, EventoLinhaTempoService, LinhaTempoBackfillService],
  exports: [EventoLinhaTempoService, LinhaTempoBackfillService],
})
export class AlunoLinhaTempoModule {}
