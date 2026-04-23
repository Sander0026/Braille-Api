import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lê quais perfis foram exigidos no @Roles() da rota
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Se a rota não tiver o carimbo @Roles(), qualquer pessoa logada pode acessar
    if (!requiredRoles) {
      return true;
    }

    // 3. Pega os dados do usuário que o AuthGuard extraiu do Token
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 4. Verifica se o usuário tem a permissão exigida
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Acesso negado. Seu perfil não tem permissão para esta ação.');
    }

    return true;
  }
}
