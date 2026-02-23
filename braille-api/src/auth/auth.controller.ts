import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Patch, Request} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from './auth.guard';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

@ApiTags('Auth (Login)') // Fica bonitinho no Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fazer login no sistema' })
  @ApiResponse({ status: 200, description: 'Login com sucesso e retorna o Token JWT' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard) // 👈 O Cadeado! Só entra com Token válido.
  @Patch('trocar-senha')
  trocarSenha(@Request() req, @Body() trocarSenhaDto: TrocarSenhaDto) {
    // Quando usamos o AuthGuard, ele decodifica o Token e injeta os dados no "req.user"
    // Geralmente o ID do usuário fica salvo no req.user.sub (que é o padrão do JWT)
    const userId = req.user.sub || req.user.id; 
    
    return this.authService.trocarSenha(userId, trocarSenhaDto);
  }
}