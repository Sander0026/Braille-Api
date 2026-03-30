import { BadRequestException, Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from '../common/dto/api-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

  async login(loginDto: LoginDto) {
    // 1. Busca o usuário no banco pelo e-mail
    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username },
    });

    // 2. Se não achar o usuário, ou se a senha estiver errada, bloqueia!
    if (!user) {
      throw new UnauthorizedException('Nome de usuário ou senha incorretos');
    }

    // 2b. Bloqueio para contas excluídas ou inativas ──────────────────────────
    if (user.excluido) {
      throw new UnauthorizedException('Usuário não encontrado no sistema. Procure o administrador.');
    }
    if (!user.statusAtivo) {
      throw new UnauthorizedException('Esta conta está desativada. Procure o administrador do sistema.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.senha, user.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nome de usuário ou senha incorretos');
    }

    // 3. Se deu tudo certo, monta o crachá (Payload do JWT de 15 min)
    const payload = { sub: user.id, nome: user.nome, role: user.role, precisaTrocarSenha: user.precisaTrocarSenha };
    const access_token = await this.jwtService.signAsync(payload);

    // 4. Gera o "Visto Longo" Randomizado de (Refresh Token)
    const randomRefreshString = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = await bcrypt.hash(randomRefreshString, 10);

    // 5. Salva o Hash na Ficha do Servidor no Banco
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken }
    });

    // 6. Retorna o Token Duplo para o Frontend (A String bruta vai via JSON)
    return {
      access_token,
      refresh_token: randomRefreshString,
      usuario: {
        id: user.id,
        nome: user.nome,
        role: user.role,
        precisaTrocarSenha: user.precisaTrocarSenha
      }
    };
  }

  async refreshToken(userId: string, rawRefreshToken: string) {
    // 1. Pede os dados no Banco
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Sua sessão expirou ou foi revogada administrativamente.');
    }

    // Bloqueia renovação de token para contas inativas/excluídas
    if (user.excluido || !user.statusAtivo) {
      throw new UnauthorizedException('Usuário não encontrado no sistema. Procure o administrador.');
    }

    // 2. Compara a Chave Mestra Limpa que veio do Angular com a Hasheada na Tabela
    const isRefreshValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);

    if (!isRefreshValid) {
      throw new UnauthorizedException('Refresh Token Inválido. Faça o login novamente.');
    }

    // 3. Retorna Passaporte Novo (15min)
    const payload = { sub: user.id, nome: user.nome, role: user.role, precisaTrocarSenha: user.precisaTrocarSenha };
    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
  }

  async trocarSenha(userId: string, trocarSenhaDto: any): Promise<ApiResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // 1. Verifica se a senha atual bate com a do banco de dados
    const senhaValida = await bcrypt.compare(trocarSenhaDto.senhaAtual, user.senha);
    if (!senhaValida) {
      throw new BadRequestException('A senha atual está incorreta. Não foi possível alterar.');
    }

    // 2. Criptografa a NOVA senha
    const novaSenhaHashed = await bcrypt.hash(trocarSenhaDto.novaSenha, 10);

    // 3. Salva no banco de dados desativando a flag de exigência
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        senha: novaSenhaHashed,
        precisaTrocarSenha: false // Se tinha block, remove!
      },
    });

    return new ApiResponse(true, null, 'Sua senha foi alterada com sucesso!');
  }

  async getMe(userId: string): Promise<ApiResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        username: true,
        email: true,
        role: true,
        fotoPerfil: true,
        statusAtivo: true,
        criadoEm: true,
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return new ApiResponse(true, user, 'Perfil carregado com sucesso.');
  }

  async atualizarFotoPerfil(userId: string, fotoPerfil: string | null): Promise<ApiResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
      data: { fotoPerfil },
    });

    return new ApiResponse(true, { fotoPerfil }, 'Foto de perfil atualizada com sucesso!');
  }

  async atualizarPerfil(userId: string, dto: { nome?: string; email?: string }): Promise<ApiResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Verifica se o e-mail já está em uso por outro usuário
    if (dto.email && dto.email !== user.email) {
      const emailEmUso = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailEmUso) throw new BadRequestException('Este e-mail já está em uso por outro usuário.');
    }

    const atualizado = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.email !== undefined && { email: dto.email }),
      },
      select: {
        id: true, nome: true, username: true,
        email: true, role: true, fotoPerfil: true,
        statusAtivo: true, criadoEm: true,
      },
    });

    return new ApiResponse(true, atualizado, 'Perfil atualizado com sucesso.');
  }
}
