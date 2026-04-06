import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService }       from '@nestjs/jwt';
import { PrismaService }    from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma:     PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token   = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Acesso negado. Token não fornecido.');
    }

    try {
      /**
       * Não passamos `secret` manualmente — o JwtService usa o secret configurado
       * via JwtModule.registerAsync + ConfigService no auth.module.ts.
       *
       * CORREÇÃO DE SEGURANÇA: passar `process.env.JWT_SECRET` diretamente poderia
       * ser `undefined` se a variável não estivesse injetada, permitindo que
       * verifyAsync aceite qualquer token sem validação de assinatura (OWASP A2).
       */
      const payload = await this.jwtService.verifyAsync(token);

      // Verificação em tempo real: conta ativa? Garante revogação imediata sem esperar JWT expirar.
      const userAtivo = await this.prisma.user.findUnique({
        where:  { id: payload.sub },
        select: { id: true, statusAtivo: true, excluido: true },
      });

      if (!userAtivo || !userAtivo.statusAtivo || userAtivo.excluido) {
        throw new UnauthorizedException('Usuário não encontrado no sistema. Procure o administrador.');
      }

      // Popula req.user com tipagem — sem índice de string 'user'
      request.user = payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    return true;
  }

  private extractTokenFromHeader(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}