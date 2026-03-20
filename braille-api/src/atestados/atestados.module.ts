import { Module } from '@nestjs/common';
import { AtestadosService } from './atestados.service';
import { AtestadosController, AtestadoController } from './atestados.controller';

@Module({
  controllers: [AtestadosController, AtestadoController],
  providers: [AtestadosService],
  exports: [AtestadosService], // exportado para uso futuro no FrequenciasModule se necessário
})
export class AtestadosModule {}
