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
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import * as ExcelJS from 'exceljs';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_EXTENSION_REGEX = /\.xlsx$/i;
const INVALID_XLSX_MESSAGE = 'Não foi possível ler a planilha. Verifique se o arquivo enviado é o modelo .xlsx válido.';

@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
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
  @ApiOperation({ summary: 'Importar alunos via planilha modelo Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, callback) => {
        const isXlsx = file.mimetype === XLSX_MIME_TYPE || XLSX_EXTENSION_REGEX.test(file.originalname);
        if (isXlsx) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Tipo de arquivo não permitido. Envie a planilha modelo no formato .xlsx.'),
            false,
          );
        }
      },
    }),
  )
  async importFromSheet(@Req() req: AuthenticatedRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado. Selecione a planilha modelo .xlsx.');
    }

    await this.validarPlanilhaXlsx(file);
    return this.beneficiariesService.importFromSheet(file.buffer, getAuditUser(req));
  }

  @Get()
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
    const date = new Date().toISOString().slice(0, 10);
    // Sanitiza status para prevenir header injection (OWASP A3)
    const status = query.inativos ? 'Inativos' : 'Ativos';
    const filename = `Alunos_${status}_${date}.xlsx`.replaceAll(/[^\w._-]/g, '_');

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    await this.beneficiariesService.exportToXlsxStream(query, res);
  }

  @Get(':id')
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
  @ApiOperation({ summary: 'Arquivar aluno em exclusao logica profunda (nao remove fisicamente)' })
  archivePermanently(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.archivePermanently(id, getAuditUser(req));
  }

  private async validarPlanilhaXlsx(file: Express.Multer.File): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(INVALID_XLSX_MESSAGE);
    }

    if (!workbook.worksheets[0]) {
      throw new BadRequestException(INVALID_XLSX_MESSAGE);
    }
  }
}
