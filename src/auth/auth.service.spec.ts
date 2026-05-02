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
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
    prisma.userSession.create.mockResolvedValue({});
    prisma.userSession.findUnique.mockResolvedValue(null);
    prisma.userSession.update.mockResolvedValue({});
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
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
    expect(prisma.userSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: usuarioBase.id,
          refreshTokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: usuarioBase.id },
      data: { refreshToken: null, refreshTokenExpiraEm: null },
    });
  });

  it('deve recusar refresh token expirado e revogar a sessao persistida', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: usuarioBase.id,
      refreshTokenHash: await bcrypt.hash('refresh-token', 10),
      previousRefreshTokenHash: null,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      user: {
        nome: usuarioBase.nome,
        role: usuarioBase.role,
        statusAtivo: usuarioBase.statusAtivo,
        excluido: usuarioBase.excluido,
        precisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    });

    await expect(service.refreshToken(`${sessionId}.refresh-token`)).rejects.toThrow(UnauthorizedException);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: sessionId, revokedAt: null }),
      }),
    );
  });

  it('deve emitir novo access token e rotacionar refresh token quando sessao esta valida', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: usuarioBase.id,
      refreshTokenHash: await bcrypt.hash('refresh-token', 10),
      previousRefreshTokenHash: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        nome: usuarioBase.nome,
        role: usuarioBase.role,
        statusAtivo: usuarioBase.statusAtivo,
        excluido: usuarioBase.excluido,
        precisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    });

    await expect(service.refreshToken(`${sessionId}.refresh-token`)).resolves.toEqual({
      access_token: 'access-token',
      refresh_token: expect.stringMatching(new RegExp(`^${sessionId}\\.[a-f0-9]{80}$`, 'i')),
    });
    expect(prisma.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId },
        data: expect.objectContaining({
          previousRefreshTokenHash: expect.any(String),
          previousRotatedAt: expect.any(Date),
          refreshTokenHash: expect.any(String),
          expiresAt: expect.any(Date),
          revokedAt: null,
        }),
      }),
    );
  });

  it('deve retornar 401 sem revogar sessao quando secret aleatorio nao corresponde ao hash atual nem ao anterior', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: usuarioBase.id,
      refreshTokenHash: await bcrypt.hash('refresh-token-atual', 10),
      previousRefreshTokenHash: await bcrypt.hash('refresh-token-anterior', 10),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        nome: usuarioBase.nome,
        role: usuarioBase.role,
        statusAtivo: usuarioBase.statusAtivo,
        excluido: usuarioBase.excluido,
        precisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    });

    await expect(service.refreshToken(`${sessionId}.token-aleatorio`)).rejects.toThrow(UnauthorizedException);

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('deve revogar sessao quando refresh token anterior for reutilizado', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId: usuarioBase.id,
      refreshTokenHash: await bcrypt.hash('refresh-token-atual', 10),
      previousRefreshTokenHash: await bcrypt.hash('refresh-token-anterior', 10),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        nome: usuarioBase.nome,
        role: usuarioBase.role,
        statusAtivo: usuarioBase.statusAtivo,
        excluido: usuarioBase.excluido,
        precisaTrocarSenha: usuarioBase.precisaTrocarSenha,
      },
    });

    await expect(service.refreshToken(`${sessionId}.refresh-token-anterior`)).rejects.toThrow(UnauthorizedException);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: sessionId, revokedAt: null }),
      }),
    );
  });

  it('deve revogar somente a sessao atual no logout quando sessionId for informado', async () => {
    const resultado = await service.logout(usuarioBase.id, sessionId);

    expect(resultado.success).toBe(true);
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId, userId: usuarioBase.id, revokedAt: null },
      }),
    );
  });

  it('deve revogar todas as sessoes do usuario quando sessionId nao for informado', async () => {
    const resultado = await service.logout(usuarioBase.id);

    expect(resultado.success).toBe(true);
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: usuarioBase.id, revokedAt: null },
      }),
    );
  });
});
