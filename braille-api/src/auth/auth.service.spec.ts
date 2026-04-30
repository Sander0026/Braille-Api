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
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
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

  const sessionId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
    service = new AuthService(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
      uploadService as unknown as UploadService,
    );
  });

  it('deve criar sessao persistida ao realizar login', async () => {
    const senhaHash = await bcrypt.hash('senha-correta', 10);
    prisma.user.findUnique.mockResolvedValue({ ...usuarioBase, senha: senhaHash });
    prisma.user.update.mockResolvedValue(usuarioBase);

    const resultado = await service.login({ username: 'admin', senha: 'senha-correta' });

    expect(resultado.access_token).toBe('access-token');
    expect(resultado.refresh_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-f0-9]{80}$/i,
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: usuarioBase.id },
      data: { refreshToken: null, refreshTokenExpiraEm: null },
    });
  });

  it('deve recusar refresh token expirado e revogar a sessao persistida', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: sessionId,
        userId: usuarioBase.id,
        refreshTokenHash: await bcrypt.hash('refresh-token', 10),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        userNome: usuarioBase.nome,
        userRole: usuarioBase.role,
        userStatusAtivo: usuarioBase.statusAtivo,
        userExcluido: usuarioBase.excluido,
        userPrecisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    ]);

    await expect(service.refreshToken(`${sessionId}.refresh-token`)).rejects.toThrow(UnauthorizedException);

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('deve emitir novo access token e rotacionar refresh token quando sessao esta valida', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: sessionId,
        userId: usuarioBase.id,
        refreshTokenHash: await bcrypt.hash('refresh-token', 10),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        userNome: usuarioBase.nome,
        userRole: usuarioBase.role,
        userStatusAtivo: usuarioBase.statusAtivo,
        userExcluido: usuarioBase.excluido,
        userPrecisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    ]);

    await expect(service.refreshToken(`${sessionId}.refresh-token`)).resolves.toEqual({
      access_token: 'access-token',
      refresh_token: expect.stringMatching(new RegExp(`^${sessionId}\\.[a-f0-9]{80}$`, 'i')),
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('deve revogar sessoes persistidas no logout', async () => {
    const resultado = await service.logout(usuarioBase.id);

    expect(resultado.success).toBe(true);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
