import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    create: jest.fn().mockResolvedValue({ id: 'dummy', _credenciais: {} }),
    findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    checkCpf: jest.fn().mockResolvedValue({ status: 'livre' }),
    update: jest.fn().mockResolvedValue({ id: 'dummy' }),
    reativar: jest.fn().mockResolvedValue({ id: 'dummy' }),
    remove: jest.fn().mockResolvedValue(true),
    resetPassword: jest.fn().mockResolvedValue(true),
    restore: jest.fn().mockResolvedValue(true),
    removeHard: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
    .overrideGuard(AuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
