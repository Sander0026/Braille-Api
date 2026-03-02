import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseGuards(AuthGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) { }

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Cadastrar um novo aluno' })
  create(@Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createBeneficiaryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os alunos (Com paginação e filtros)' })
  findAll(@Query() query: QueryBeneficiaryDto) {
    return this.beneficiariesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar aluno por ID' })
  findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Atualizar dados de um aluno existente' })
  update(@Param('id') id: string, @Body() updateBeneficiaryDto: UpdateBeneficiaryDto) {
    return this.beneficiariesService.update(id, updateBeneficiaryDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Inativar um aluno (Soft Delete)' })
  remove(@Param('id') id: string) {
    return this.beneficiariesService.remove(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Restaurar um aluno inativado' })
  restore(@Param('id') id: string) {
    return this.beneficiariesService.restore(id);
  }

  @Delete(':id/hard')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Excluir definitivamente um aluno (Soft Delete Nvl 2)' })
  removeHard(@Param('id') id: string) {
    return this.beneficiariesService.removeHard(id);
  }
}