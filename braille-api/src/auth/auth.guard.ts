import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Acesso negado. Token não fornecido.');
    }
    
    try {
      // Verifica se o token é válido usando a mesma chave do .env
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // ── Verificação em Tempo Real: o usuário ainda está ativo? ──
      // Consulta rápida ao banco para garantir que contas deletadas ou
      // inativadas PERCAM ACESSO IMEDIATAMENTE, sem esperar o JWT expirar.
      const userAtivo = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, statusAtivo: true, excluido: true },
      });

      if (!userAtivo || !userAtivo.statusAtivo || userAtivo.excluido) {
        throw new UnauthorizedException('Sua conta foi desativada ou excluída. Contate o administrador.');
      }

      // Pendura os dados do usuário na requisição para usarmos depois
      request['user'] = payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}