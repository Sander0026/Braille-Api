import { Test, TestingModule } from '@nestjs/testing';
import { FrequenciasController } from './frequencias.controller';
import { FrequenciasService } from './frequencias.service';

describe('FrequenciasController', () => {
  let controller: FrequenciasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FrequenciasController],
      providers: [FrequenciasService],
    }).compile();

    controller = module.get<FrequenciasController>(FrequenciasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
