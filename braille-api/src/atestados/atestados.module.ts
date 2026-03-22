import { Module } from '@nestjs/common';
import { AtestadosService } from './atestados.service';
import { AtestadosController, AtestadoController } from './atestados.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [AtestadosController, AtestadoController],
  providers: [AtestadosService],
  exports: [AtestadosService], // exportado para uso futuro no FrequenciasModule se necessário
})
export class AtestadosModule {}
