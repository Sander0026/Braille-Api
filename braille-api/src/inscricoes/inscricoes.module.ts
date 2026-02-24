import { Module } from '@nestjs/common';
import { InscricoesService } from './inscricoes.service';
import { InscricoesController } from './inscricoes.controller';

@Module({
  controllers: [InscricoesController],
  providers: [InscricoesService],
})
export class InscricoesModule {}
