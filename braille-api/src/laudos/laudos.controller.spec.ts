import { Test, TestingModule } from '@nestjs/testing';
import { LaudosController } from './laudos.controller';
import { LaudosService } from './laudos.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockService = {
  criar: jest.fn().mockResolvedValue({ id: 'laudo1' }),
  listarPorAluno: jest.fn().mockResolvedValue([]),
};

describe('LaudosController', () => {
  let controller: LaudosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaudosController],
      providers: [
        { provide: LaudosService, useValue: mockService },
      ],
    })
    .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<LaudosController>(LaudosController);
  });

  it('deve listar laudos delegando ao Service', async () => {
    expect(controller).toBeDefined();
    const res = await controller.findAll('aluno123');
    expect(res).toEqual([]);
    expect(mockService.listarPorAluno).toHaveBeenCalledWith('aluno123');
  });
});
