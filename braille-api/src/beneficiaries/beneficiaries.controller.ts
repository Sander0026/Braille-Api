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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
];

@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Cadastrar um novo aluno' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(dto, getAuditUser(req));
  }

  @Post('import')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Importar alunos via planilha Excel (.xlsx) ou CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, callback) => {
        const allowed = ALLOWED_MIME_TYPES.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname);
        if (allowed) {
          callback(null, true);
        } else {
          callback(new BadRequestException('Tipo de arquivo não permitido. Envie um arquivo .xlsx ou .csv.'), false);
        }
      },
    }),
  )
  importFromSheet(@Req() req: AuthenticatedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.beneficiariesService.importFromSheet(file.buffer, getAuditUser(req));
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Listar todos os alunos (Com paginação e filtros)' })
  findAll(@Query() query: QueryBeneficiaryDto) {
    return this.beneficiariesService.findAll(query);
  }

  @Get('check-cpf-rg')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Verifica se um CPF ou RG já existe no sistema' })
  checkCpfRg(@Query('cpf') cpf?: string, @Query('rg') rg?: string) {
    if (!cpf && !rg) throw new BadRequestException('Informe o CPF ou o RG para verificação.');
    return this.beneficiariesService.checkCpfRg(cpf, rg);
  }

  @Get('export')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Exportar lista de alunos filtrada como planilha Excel (.xlsx)' })
  async exportXlsx(@Query() query: QueryBeneficiaryDto, @Res() res: Response) {
    const buffer = await this.beneficiariesService.exportToXlsx(query);
    const date = new Date().toISOString().slice(0, 10);
    // Sanitiza status para prevenir header injection (OWASP A3)
    const status = query.inativos ? 'Inativos' : 'Ativos';
    const filename = `Alunos_${status}_${date}.xlsx`.replaceAll(/[^\w._-]/g, '_');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Buscar aluno por ID' })
  findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Atualizar dados de um aluno existente' })
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateBeneficiaryDto) {
    return this.beneficiariesService.update(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Inativar um aluno (Soft Delete)' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.remove(id, getAuditUser(req));
  }

  @Post(':id/reactivate')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Reativar um aluno arquivado/inativo' })
  reactivate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.reactivate(id, getAuditUser(req));
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Restaurar um aluno inativado' })
  restore(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.restore(id, getAuditUser(req));
  }

  @Delete(':id/hard')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Excluir definitivamente um aluno (Soft Delete Nvl 2)' })
  removeHard(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.removeHard(id, getAuditUser(req));
  }
}
