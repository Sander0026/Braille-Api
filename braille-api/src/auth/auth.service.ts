import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
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

    const isPasswordValid = await bcrypt.compare(loginDto.senha, user.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nome de usuário ou senha incorretos');
    }

    // 3. Se deu tudo certo, monta o crachá (Payload do JWT)
    const payload = { sub: user.id, nome: user.nome, role: user.role, precisaTrocarSenha: user.precisaTrocarSenha };

    // 4. Retorna o Token para o Frontend
    return {
      access_token: await this.jwtService.signAsync(payload),
      usuario: {
        nome: user.nome,
        role: user.role,
        precisaTrocarSenha: user.precisaTrocarSenha
      }
    };
  }

  async trocarSenha(userId: string, trocarSenhaDto: any) {
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

    return { message: 'Sua senha foi alterada com sucesso!' };
  }

  async getMe(userId: string) {
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
    return user;
  }

  async atualizarFotoPerfil(userId: string, fotoPerfil: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { fotoPerfil },
    });

    return { message: 'Foto de perfil atualizada com sucesso!', fotoPerfil };
  }
}