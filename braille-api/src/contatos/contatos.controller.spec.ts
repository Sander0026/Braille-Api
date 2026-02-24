import { Test, TestingModule } from '@nestjs/testing';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';

describe('ContatosController', () => {
  let controller: ContatosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContatosController],
      providers: [ContatosService],
    }).compile();

    controller = module.get<ContatosController>(ContatosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
