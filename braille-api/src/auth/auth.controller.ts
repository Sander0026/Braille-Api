import {
  Controller, Post, Body, HttpCode, HttpStatus,
  UseGuards, Patch, Get, Req, UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation,
  ApiResponse as SwaggerResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService }          from './auth.service';
import { AuthGuard }            from './auth.guard';
import { LoginDto }             from './dto/login.dto';
import { RefreshTokenDto }      from './dto/refresh-token.dto';
import { TrocarSenhaDto }       from './dto/trocar-senha.dto';
import { AtualizarFotoDto }     from './dto/atualizar-foto.dto';
import { AtualizarPerfilDto }   from './dto/atualizar-perfil.dto';
import { ApiResponse }          from '../common/dto/api-response.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/**
 * AuthController — rotas públicas e semi-públicas de autenticação.
 * Controller magro: extração de userId centralizada em `resolverUserId()`.
 */
@ApiTags('Auth (Login)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login no sistema' })
  @SwaggerResponse({ status: 200, description: 'Login com sucesso e retorna o Token JWT' })
  @SwaggerResponse({ status: 401, description: 'Credenciais inválidas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Renovar Token Expirado (Refresh Silencioso)' })
  @SwaggerResponse({ status: 201, description: 'Sessão validada e Novo Token de 15m Emitido' })
  @SwaggerResponse({ status: 401, description: 'Refresh Token Inválido ou Sessão Encerrada' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.userId, dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário logado (nome, role, fotoPerfil, etc.)' })
  @SwaggerResponse({ status: 200, description: 'Retorna os dados cadastrais em ApiResponse' })
  getMe(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    return this.authService.getMe(this.resolverUserId(req));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('trocar-senha')
  @ApiOperation({ summary: 'Trocar a própria senha (requer senha atual)' })
  @SwaggerResponse({ status: 200, description: 'Senha alterada com sucesso' })
  trocarSenha(
    @Req()  req: AuthenticatedRequest,
    @Body() dto: TrocarSenhaDto,
  ): Promise<ApiResponse<null>> {
    return this.authService.trocarSenha(this.resolverUserId(req), dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('foto-perfil')
  @ApiOperation({ summary: 'Atualizar a foto de perfil do usuário logado' })
  @SwaggerResponse({ status: 200, description: 'Foto URL atualizada com sucesso' })
  atualizarFotoPerfil(
    @Req()  req: AuthenticatedRequest,
    @Body() dto: AtualizarFotoDto,
  ): Promise<ApiResponse<unknown>> {
    return this.authService.atualizarFotoPerfil(this.resolverUserId(req), dto.fotoPerfil);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('perfil')
  @ApiOperation({ summary: 'Atualizar nome e e-mail do perfil do usuário logado' })
  @SwaggerResponse({ status: 200, description: 'Dados do perfil atualizados com sucesso' })
  atualizarPerfil(
    @Req()  req: AuthenticatedRequest,
    @Body() dto: AtualizarPerfilDto,
  ): Promise<ApiResponse<unknown>> {
    return this.authService.atualizarPerfil(this.resolverUserId(req), dto);
  }

  /**
   * Extrai o userId do token JWT de forma segura e tipada.
   * Centralizado para eliminar `req.user?.sub as string` repetido × 4.
   * O AuthGuard garante que `req.user.sub` existe ao chegar aqui.
   */
  private resolverUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Sessão inválida.');
    return userId;
  }
}
