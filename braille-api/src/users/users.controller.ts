import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard'; 
import { Roles } from '../auth/roles.decorator';

@ApiTags('Usuários do Sistema (Staff)')
@ApiBearerAuth() // Cadeado do Swagger
@UseGuards(AuthGuard, RolesGuard) // Aplica os guards de autenticação e autorização para todas as rotas desse controller
@Roles('ADMIN') // Somente quem tem a role ADMIN pode acessar as rotas desse controller
@UseGuards(AuthGuard) // Bloqueia quem não tem Token
@Controller('users') // Rota base para usuários
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar um novo usuário (Secretaria, Prof, etc)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os usuários da instituição' })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um usuário' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir um usuário do sistema' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}