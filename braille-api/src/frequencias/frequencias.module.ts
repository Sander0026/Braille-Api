import { Module } from '@nestjs/common';
import { FrequenciasService } from './frequencias.service';
import { FrequenciasController } from './frequencias.controller';

@Module({
  controllers: [FrequenciasController],
  providers: [FrequenciasService],
})
export class FrequenciasModule {}
