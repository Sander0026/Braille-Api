import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Patch, Get, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';
import { AtualizarFotoDto } from './dto/atualizar-foto.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Auth (Login)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login no sistema' })
  @SwaggerResponse({ status: 200, description: 'Login com sucesso e retorna o Token JWT' })
  @SwaggerResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Renovar Token Expirado (Refresh Silencioso)' })
  @SwaggerResponse({ status: 201, description: 'Sessão validada e o Novo Token de 15m Emitido' })
  @SwaggerResponse({ status: 401, description: 'Refresh Token Inválido ou Sessão Encerrada pelo T.I.' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.userId, refreshTokenDto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário logado (nome, role, fotoPerfil, etc.)' })
  @SwaggerResponse({ status: 200, description: 'Retorna os dados cadastrais em ApiResponse' })
  async getMe(@Req() req: AuthenticatedRequest): Promise<ApiResponse<any>> {
    const userId = req.user?.sub as string;
    return this.authService.getMe(userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('trocar-senha')
  @ApiOperation({ summary: 'Trocar a própria senha (requer senha atual)' })
  @SwaggerResponse({ status: 200, description: 'Retorna mensagem de sucesso' })
  async trocarSenha(@Req() req: AuthenticatedRequest, @Body() trocarSenhaDto: TrocarSenhaDto): Promise<ApiResponse<any>> {
    const userId = req.user?.sub as string;
    return this.authService.trocarSenha(userId, trocarSenhaDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('foto-perfil')
  @ApiOperation({ summary: 'Atualizar a foto de perfil do usuário logado' })
  @SwaggerResponse({ status: 200, description: 'Retorna foto url atualizada' })
  async atualizarFotoPerfil(@Req() req: AuthenticatedRequest, @Body() dto: AtualizarFotoDto): Promise<ApiResponse<any>> {
    const userId = req.user?.sub as string;
    return this.authService.atualizarFotoPerfil(userId, dto.fotoPerfil);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('perfil')
  @ApiOperation({ summary: 'Atualizar nome e e-mail do perfil do usuário logado' })
  @SwaggerResponse({ status: 200, description: 'Retorna novos dados atualizados' })
  async atualizarPerfil(@Req() req: AuthenticatedRequest, @Body() dto: AtualizarPerfilDto): Promise<ApiResponse<any>> {
    const userId = req.user?.sub as string;
    return this.authService.atualizarPerfil(userId, dto);
  }
}
