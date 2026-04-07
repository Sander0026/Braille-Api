import { Test, TestingModule } from '@nestjs/testing';
import { FrequenciasController } from './frequencias.controller';
import { FrequenciasService } from './frequencias.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockService = {
  create: jest.fn().mockResolvedValue({ id: 'f1' }),
  findAll: jest.fn().mockResolvedValue({ data: [] }),
};

describe('FrequenciasController', () => {
  let controller: FrequenciasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FrequenciasController],
      providers: [
        { provide: FrequenciasService, useValue: mockService },
      ],
    })
    .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<FrequenciasController>(FrequenciasController);
  });

  it('deve ser instanciado e retornar listagem via Service', async () => {
    expect(controller).toBeDefined();
    const res = await controller.findAll({});
    expect(res).toEqual({ data: [] });
    expect(mockService.findAll).toHaveBeenCalledWith({});
  });
});
