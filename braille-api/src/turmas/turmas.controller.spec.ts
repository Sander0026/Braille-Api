import { Test, TestingModule } from '@nestjs/testing';
import { TurmasController } from './turmas.controller';
import { TurmasService } from './turmas.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('TurmasController', () => {
  let controller: TurmasController;

  const mockTurmasService = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TurmasController],
      providers: [
        { provide: TurmasService, useValue: mockTurmasService },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    })
    .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<TurmasController>(TurmasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
