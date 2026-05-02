import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { QueryUserDto } from './dto/query-user.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';

@ApiTags('Usuários do Sistema (Staff)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@SkipAudit()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Cadastrar novo funcionário. Username, senha padrão e matrícula são gerados automaticamente.',
  })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Requer role ADMIN.' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.create(createUserDto, getAuditUser(req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os usuários da instituição' })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Requer role ADMIN.' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Listar usuarios com dados minimos para selecoes internas' })
  @ApiResponse({ status: 200, description: 'Resumo de usuários retornado.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  findResumo(@Query() query: QueryUserDto) {
    return this.usersService.findResumo(query);
  }

  @Get('check-cpf')
  @ApiOperation({ summary: 'Verifica se um CPF já existe no sistema' })
  @ApiQuery({ name: 'cpf', required: true, description: 'CPF a verificar' })
  @ApiResponse({ status: 200, description: 'Resultado da verificação.' })
  @ApiResponse({ status: 400, description: 'CPF não informado.' })
  async checkCpf(@Query('cpf') cpf?: string) {
    if (!cpf) throw new BadRequestException('Informe o CPF para verificação.');
    return this.usersService.checkCpf(cpf);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um usuário' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.update(id, updateUserDto, getAuditUser(req));
  }

  @Post(':id/reativar')
  @ApiOperation({ summary: 'Reativar um funcionário inativo. Gera nova senha padrão e restaura o acesso.' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 201, description: 'Usuário reativado com nova senha padrão.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  reativar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.reativar(id, getAuditUser(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inativar um usuário do sistema' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário inativado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.remove(id, getAuditUser(req));
  }

  @Patch(':id/reset-password')
  @ApiOperation({ summary: 'Resetar a senha de um usuário (Admin)' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Senha resetada para o padrão.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  resetPassword(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.resetPassword(id, getAuditUser(req));
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restaurar um usuário inativo' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário restaurado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.restore(id, getAuditUser(req));
  }

  @Delete(':id/hard')
  @ApiOperation({ summary: 'Excluir definitivamente um usuário (Soft Delete profundo)' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: 200, description: 'Usuário excluído permanentemente.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  removeHard(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.removeHard(id, getAuditUser(req));
  }
}
