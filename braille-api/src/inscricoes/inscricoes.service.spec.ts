import { Test, TestingModule } from '@nestjs/testing';
import { InscricoesService } from './inscricoes.service';

describe('InscricoesService', () => {
  let service: InscricoesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InscricoesService],
    }).compile();

    service = module.get<InscricoesService>(InscricoesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
