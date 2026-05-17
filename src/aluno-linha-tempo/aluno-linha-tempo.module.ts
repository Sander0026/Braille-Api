import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlunoLinhaTempoController } from './aluno-linha-tempo.controller';
import { AlunoLinhaTempoService } from './aluno-linha-tempo.service';

@Module({
  imports: [PrismaModule],
  controllers: [AlunoLinhaTempoController],
  providers: [AlunoLinhaTempoService],
})
export class AlunoLinhaTempoModule {}
