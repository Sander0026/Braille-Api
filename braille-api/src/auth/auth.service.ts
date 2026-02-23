import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '.prisma/client';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto) {
    // 1. Busca o usuário no banco pelo e-mail
    const user = await prisma.user.findUnique({
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
    const payload = { sub: user.id, nome: user.nome, role: user.role };

    // 4. Retorna o Token para o Frontend
    return {
      access_token: await this.jwtService.signAsync(payload),
      usuario: {
        nome: user.nome,
        role: user.role,
      }
    };
  }
}