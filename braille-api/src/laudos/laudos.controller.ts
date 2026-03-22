import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Req,
} from '@nestjs/common';
import { LaudosService } from './laudos.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class LaudosController {
  constructor(private readonly laudosService: LaudosService) {}

  @Roles('ADMIN', 'SECRETARIA')
  @Post('alunos/:alunoId/laudos')
  create(
    @Param('alunoId') alunoId: string,
    @Body() createLaudoDto: CreateLaudoDto,
    @Req() req: any,
  ) {
    const usuarioId = req.user.id;
    return this.laudosService.criar(alunoId, createLaudoDto, usuarioId);
  }

  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR')
  @Get('alunos/:alunoId/laudos')
  findAll(@Param('alunoId') alunoId: string) {
    return this.laudosService.listarPorAluno(alunoId);
  }

  @Roles('ADMIN', 'SECRETARIA')
  @Patch('laudos/:id')
  update(@Param('id') id: string, @Body() updateLaudoDto: UpdateLaudoDto) {
    return this.laudosService.atualizar(id, updateLaudoDto);
  }

  @Roles('ADMIN', 'SECRETARIA')
  @Delete('laudos/:id')
  remove(@Param('id') id: string) {
    return this.laudosService.remover(id);
  }
}
