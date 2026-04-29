import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
    trocarSenha: jest.fn(),
    atualizarFotoPerfil: jest.fn(),
    atualizarPerfil: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('deve delegar logout usando o usuario autenticado', async () => {
    authService.logout.mockResolvedValue({ success: true, data: null, message: 'Logout realizado com sucesso.' });

    await controller.logout({ user: { sub: 'user-1' } } as AuthenticatedRequest);

    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });

  it('deve rejeitar logout sem usuario autenticado', async () => {
    expect(() => controller.logout({ user: undefined } as AuthenticatedRequest)).toThrow(UnauthorizedException);
  });
});
