import { Test, TestingModule } from '@nestjs/testing';
import { FrequenciasService } from './frequencias.service';

describe('FrequenciasService', () => {
  let service: FrequenciasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FrequenciasService],
    }).compile();

    service = module.get<FrequenciasService>(FrequenciasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
