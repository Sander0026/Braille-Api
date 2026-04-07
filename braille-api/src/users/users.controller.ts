import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, BadRequestException, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { QueryUserDto } from './dto/query-user.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { getAuditUser } from '../common/helpers/audit.helper';

@ApiTags('Usuários do Sistema (Staff)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cadastrar novo funcionário. Username, senha padrão e matrícula são gerados automaticamente.' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.create(createUserDto, getAuditUser(req));
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR, Role.COMUNICACAO)
  @ApiOperation({ summary: 'Listar todos os usuários da instituição' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get('check-cpf')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Verifica se um CPF já existe no sistema' })
  async checkCpf(@Query('cpf') cpf?: string) {
    if (!cpf) throw new BadRequestException('Informe o CPF para verificação.');
    return this.usersService.checkCpf(cpf);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar dados de um usuário' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.update(id, updateUserDto, getAuditUser(req));
  }

  @Post(':id/reativar')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reativar um funcionário inativo. Gera nova senha padrão e restaura o acesso.' })
  reativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.reativar(id, getAuditUser(req));
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Inativar um usuário do sistema' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.remove(id, getAuditUser(req));
  }

  @Patch(':id/reset-password')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Resetar a senha de um usuário (Admin)' })
  resetPassword(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.resetPassword(id, getAuditUser(req));
  }

  @Patch(':id/restore')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Restaurar um usuário inativo' })
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.restore(id, getAuditUser(req));
  }

  @Delete(':id/hard')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Excluir definitivamente um usuário (Soft Delete profundo)' })
  removeHard(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.removeHard(id, getAuditUser(req));
  }
}
