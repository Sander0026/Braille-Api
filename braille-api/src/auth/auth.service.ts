import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { ApiResponse } from '../common/dto/api-response.dto';

// ── SELECT cirúrgico reutilizado — não trafega campos desnecessários ──────────

/** Campos mínimos para construir o payload JWT (nunca inclui senha ou refreshToken). */
const AUTH_SELECT = {
  id: true,
  nome: true,
  role: true,
  statusAtivo: true,
  excluido: true,
  precisaTrocarSenha: true,
} as const;

/** Campos do perfil público (equivalente ao que getMe retorna). */
const PERFIL_SELECT = {
  id: true,
  nome: true,
  username: true,
  email: true,
  role: true,
  fotoPerfil: true,
  statusAtivo: true,
  criadoEm: true,
} as const;

const REFRESH_TOKEN_TTL_DIAS = 7;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DIAS * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Hash falso para normalizar o tempo de resposta do login (anti-timing-attack / CWE-208).
   * Semente gerada aleatoriamente em cada startup — sem valor hardcoded (evita CWE-547).
   * O hash é recriado 1× por instância de serviço (startup); não impacta performance em runtime.
   */
  private readonly dummyHash: string = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(loginDto: LoginDto) {
    // Select mínimo — nunca incluir refreshToken nem outros hashes desnecessários
    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username },
      select: { ...AUTH_SELECT, senha: true },
    });

    /**
     * TIMING ATTACK FIX (CWE-208):
     * Se o user não existe, ainda executamos bcrypt.compare contra o dummyHash
     * para garantir que a resposta demore ~100ms independentemente do resultado.
     * Sem isso, a diferença de tempo (com/sem bcrypt) revela se o username existe.
     */
    const senhaParaComparar = user?.senha ?? this.dummyHash;
    const isPasswordValid = await bcrypt.compare(loginDto.senha, senhaParaComparar);

    // Mensagem genérica — não revela se o username existe ou não
    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Nome de usuário ou senha incorretos.');
    }

    if (user.excluido) {
      throw new UnauthorizedException('Usuário não encontrado no sistema. Procure o administrador.');
    }

    if (!user.statusAtivo) {
      throw new UnauthorizedException('Esta conta está desativada. Procure o administrador do sistema.');
    }

    const payload = {
      sub: user.id,
      nome: user.nome,
      role: user.role,
      precisaTrocarSenha: user.precisaTrocarSenha,
    };
    const access_token = await this.jwtService.signAsync(payload);

    // Gera e armazena refresh token (string bruta → hash no banco)
    const refresh = await this.gerarRefreshTokenSeguro();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refresh.hashedRefreshToken,
        refreshTokenExpiraEm: refresh.refreshTokenExpiraEm,
      },
    });

    return {
      access_token,
      refresh_token: refresh.rawRefreshToken,
      usuario: {
        id: user.id,
        nome: user.nome,
        role: user.role,
        precisaTrocarSenha: user.precisaTrocarSenha,
      },
    };
  }

  // ── Refresh Token ──────────────────────────────────────────────────────────

  async refreshToken(userId: string, rawRefreshToken: string) {
    // Select mínimo — exclui senha e outros campos pesados
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...AUTH_SELECT, refreshToken: true, refreshTokenExpiraEm: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Sua sessão expirou ou foi revogada administrativamente.');
    }

    if (!user.refreshTokenExpiraEm || user.refreshTokenExpiraEm.getTime() <= Date.now()) {
      await this.revogarRefreshToken(user.id);
      throw new UnauthorizedException('Sua sessao expirou. Faca o login novamente.');
    }

    if (user.excluido || !user.statusAtivo) {
      throw new UnauthorizedException('Usuário não encontrado no sistema. Procure o administrador.');
    }

    const isRefreshValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!isRefreshValid) {
      throw new UnauthorizedException('Refresh Token inválido. Faça o login novamente.');
    }

    const payload = {
      sub: user.id,
      nome: user.nome,
      role: user.role,
      precisaTrocarSenha: user.precisaTrocarSenha,
    };
    const access_token = await this.jwtService.signAsync(payload);

    // Refresh Token Rotation: cada uso válido invalida o refresh token anterior.
    const refresh = await this.gerarRefreshTokenSeguro();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refresh.hashedRefreshToken,
        refreshTokenExpiraEm: refresh.refreshTokenExpiraEm,
      },
    });

    return {
      access_token,
      refresh_token: refresh.rawRefreshToken,
    };
  }

  // ── Trocar Senha ───────────────────────────────────────────────────────────

  async logout(userId: string): Promise<ApiResponse<null>> {
    await this.revogarRefreshToken(userId);
    return new ApiResponse(true, null, 'Logout realizado com sucesso.');
  }

  async trocarSenha(userId: string, dto: TrocarSenhaDto): Promise<ApiResponse<null>> {
    // Select mínimo — só precisamos da senha atual para comparar
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, senha: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const senhaValida = await bcrypt.compare(dto.senhaAtual, user.senha);
    if (!senhaValida) {
      throw new BadRequestException('A senha atual está incorreta. Não foi possível alterar.');
    }

    const novaSenhaHashed = await bcrypt.hash(dto.novaSenha, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { senha: novaSenhaHashed, precisaTrocarSenha: false },
    });

    return new ApiResponse(true, null, 'Sua senha foi alterada com sucesso!');
  }

  // ── Perfil ─────────────────────────────────────────────────────────────────

  async getMe(userId: string): Promise<ApiResponse<unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PERFIL_SELECT,
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return new ApiResponse(true, user, 'Perfil carregado com sucesso.');
  }

  async atualizarFotoPerfil(userId: string, fotoPerfil: string | null | undefined): Promise<ApiResponse<unknown>> {
    // Select cirúrgico — só precisamos do fotoPerfil atual para deletar do Cloudinary
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fotoPerfil: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (fotoPerfil !== undefined && user.fotoPerfil && fotoPerfil !== user.fotoPerfil) {
      try {
        await this.uploadService.deleteFile(user.fotoPerfil);
      } catch (e: unknown) {
        const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
        this.logger.warn(`Foto de perfil antiga não removida do Cloudinary: ${erroMsg}`);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { fotoPerfil: fotoPerfil ?? null },
    });

    return new ApiResponse(true, { fotoPerfil }, 'Foto de perfil atualizada com sucesso!');
  }

  async atualizarPerfil(userId: string, dto: AtualizarPerfilDto): Promise<ApiResponse<unknown>> {
    // Cláusula de guarda: verifica conflito de e-mail antes de atualizar
    if (dto.email) {
      const emailEmUso = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (emailEmUso) {
        throw new BadRequestException('Este e-mail já está em uso por outro usuário.');
      }
    }

    const atualizado = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.email !== undefined && { email: dto.email }),
      },
      select: PERFIL_SELECT,
    });

    return new ApiResponse(true, atualizado, 'Perfil atualizado com sucesso.');
  }

  private async gerarRefreshTokenSeguro(): Promise<{
    rawRefreshToken: string;
    hashedRefreshToken: string;
    refreshTokenExpiraEm: Date;
  }> {
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);
    const refreshTokenExpiraEm = this.calcularExpiracaoRefreshToken();

    return { rawRefreshToken, hashedRefreshToken, refreshTokenExpiraEm };
  }

  private calcularExpiracaoRefreshToken(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  }

  private async revogarRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenExpiraEm: null },
    });
  }
}
