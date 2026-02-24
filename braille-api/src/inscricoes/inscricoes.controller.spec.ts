import { Test, TestingModule } from '@nestjs/testing';
import { InscricoesController } from './inscricoes.controller';
import { InscricoesService } from './inscricoes.service';

describe('InscricoesController', () => {
  let controller: InscricoesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InscricoesController],
      providers: [InscricoesService],
    }).compile();

    controller = module.get<InscricoesController>(InscricoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
