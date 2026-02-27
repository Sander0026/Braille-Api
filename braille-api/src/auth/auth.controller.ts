import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Patch, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';
import { AtualizarFotoDto } from './dto/atualizar-foto.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

@ApiTags('Auth (Login)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login no sistema' })
  @ApiResponse({ status: 200, description: 'Login com sucesso e retorna o Token JWT' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário logado (nome, role, fotoPerfil, etc.)' })
  getMe(@Request() req) {
    const userId = req.user.sub || req.user.id;
    return this.authService.getMe(userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('trocar-senha')
  @ApiOperation({ summary: 'Trocar a própria senha (requer senha atual)' })
  trocarSenha(@Request() req, @Body() trocarSenhaDto: TrocarSenhaDto) {
    const userId = req.user.sub || req.user.id;
    return this.authService.trocarSenha(userId, trocarSenhaDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('foto-perfil')
  @ApiOperation({ summary: 'Atualizar a foto de perfil do usuário logado' })
  atualizarFotoPerfil(@Request() req, @Body() dto: AtualizarFotoDto) {
    const userId = req.user.sub || req.user.id;
    return this.authService.atualizarFotoPerfil(userId, dto.fotoPerfil);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('perfil')
  @ApiOperation({ summary: 'Atualizar nome e e-mail do perfil do usuário logado' })
  atualizarPerfil(@Request() req, @Body() dto: AtualizarPerfilDto) {
    const userId = req.user.sub || req.user.id;
    return this.authService.atualizarPerfil(userId, dto);
  }
}
