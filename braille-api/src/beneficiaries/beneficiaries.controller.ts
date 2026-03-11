import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query,
  UseInterceptors, UploadedFile, BadRequestException, Res
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) { }

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Cadastrar um novo aluno' })
  create(@Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createBeneficiaryDto);
  }

  @Post('import')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Importar alunos via planilha Excel (.xlsx) ou CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, callback) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel',   // .xls
        'text/csv',                   // .csv
        'application/csv',
      ];
      if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('Tipo de arquivo não permitido. Envie um arquivo .xlsx ou .csv.'), false);
      }
    },
  }))
  importFromSheet(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.beneficiariesService.importFromSheet(file.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os alunos (Com paginação e filtros)' })
  findAll(@Query() query: QueryBeneficiaryDto) {
    return this.beneficiariesService.findAll(query);
  }

  @Get('check-cpf')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Verifica se um CPF/RG já existe no sistema' })
  async checkCpfRg(@Query('cpfRg') cpfRg: string) {
    return this.beneficiariesService.checkCpfRg(cpfRg);
  }

  @Get('export')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Exportar lista de alunos filtrada como planilha Excel (.xlsx)' })
  async exportXlsx(@Query() query: QueryBeneficiaryDto, @Res() res: Response) {
    const buffer = await this.beneficiariesService.exportToXlsx(query);
    const date = new Date().toISOString().slice(0, 10);
    const status = query.inativos ? 'Inativos' : 'Ativos';
    const filename = `Alunos_${status}_${date}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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

  @Post(':id/reactivate')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Reativar um aluno arquivado/inativo' })
  reactivate(@Param('id') id: string) {
    return this.beneficiariesService.reactivate(id);
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