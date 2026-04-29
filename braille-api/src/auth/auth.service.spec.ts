import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const uploadService = {
    deleteFile: jest.fn(),
  };

  const usuarioBase = {
    id: 'user-1',
    nome: 'Admin',
    role: Role.ADMIN,
    statusAtivo: true,
    excluido: false,
    precisaTrocarSenha: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
      uploadService as unknown as UploadService,
    );
  });

  it('deve salvar refresh token com data de expiracao ao realizar login', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 10);
    prisma.user.findUnique.mockResolvedValue({ ...usuarioBase, senha: senhaHash });
    prisma.user.update.mockResolvedValue(usuarioBase);

    const resultado = await service.login({ username: 'admin', senha: 'senha-correta' });

    expect(resultado.access_token).toBe('access-token');
    expect(resultado.refresh_token).toHaveLength(80);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: usuarioBase.id },
      data: {
        refreshToken: expect.any(String),
        refreshTokenExpiraEm: expect.any(Date),
      },
    });

    const data = prisma.user.update.mock.calls[0][0].data.refreshTokenExpiraEm as Date;
    expect(data.getTime()).toBeGreaterThan(Date.now());
  });

  it('deve recusar refresh token expirado e revogar a sessao persistida', async () => {
    const tokenHash = await bcrypt.hash('refresh-token', 10);
    prisma.user.findUnique.mockResolvedValue({
      ...usuarioBase,
      refreshToken: tokenHash,
      refreshTokenExpiraEm: new Date(Date.now() - 1000),
    });
    prisma.user.update.mockResolvedValue(usuarioBase);

    await expect(service.refreshToken(usuarioBase.id, 'refresh-token')).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: usuarioBase.id },
      data: { refreshToken: null, refreshTokenExpiraEm: null },
    });
  });

  it('deve emitir novo access token quando refresh token ainda esta valido', async () => {
    const tokenHash = await bcrypt.hash('refresh-token', 10);
    prisma.user.findUnique.mockResolvedValue({
      ...usuarioBase,
      refreshToken: tokenHash,
      refreshTokenExpiraEm: new Date(Date.now() + 60_000),
    });

    await expect(service.refreshToken(usuarioBase.id, 'refresh-token')).resolves.toEqual({
      access_token: 'access-token',
    });
  });

  it('deve revogar refresh token no logout', async () => {
    prisma.user.update.mockResolvedValue(usuarioBase);

    const resultado = await service.logout(usuarioBase.id);

    expect(resultado.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: usuarioBase.id },
      data: { refreshToken: null, refreshTokenExpiraEm: null },
    });
  });
});
