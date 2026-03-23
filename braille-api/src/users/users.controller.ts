import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryUserDto } from './dto/query-user.dto';

@ApiTags('Usuários do Sistema (Staff)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cadastrar novo funcionário. Username, senha padrão e matrícula são gerados automaticamente.' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Listar todos os usuários da instituição' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Atualizar dados de um usuário' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/reativar')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reativar um funcionário inativo. Gera nova senha padrão e restaura o acesso.' })
  reativar(@Param('id') id: string) {
    return this.usersService.reativar(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Inativar um usuário do sistema' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/reset-password')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Resetar a senha de um usuário (Admin)' })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Restaurar um usuário inativo' })
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  @Delete(':id/hard')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Excluir definitivamente um usuário (Soft Delete profundo)' })
  removeHard(@Param('id') id: string) {
    return this.usersService.removeHard(id);
  }
}
