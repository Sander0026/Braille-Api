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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import * as ExcelJS from 'exceljs';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { QueryBeneficiaryDto } from './dto/query-beneficiary.dto';
import { ImportBatchDto } from './dto/import-batch.dto';
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
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Cadastrar um novo aluno' })
  @ApiResponse({ status: 201, description: 'Aluno cadastrado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido ou CPF/RG já existente.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(dto, getAuditUser(req));
  }

  @Post('import')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Importar alunos via planilha modelo Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Alunos importados. Retorna contagem e erros por linha.' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou formato não suportado.' })
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

  @Post('import-batch')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Importar alunos em lotes (JSON) - Maior performance' })
  @ApiResponse({ status: 201, description: 'Lote importado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  async importBatch(@Req() req: AuthenticatedRequest, @Body() dto: ImportBatchDto) {
    if (!dto.data || !Array.isArray(dto.data) || dto.data.length === 0) {
      throw new BadRequestException('O lote de dados está vazio ou inválido.');
    }
    return this.beneficiariesService.importBatchData(dto.data, getAuditUser(req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os alunos (Com paginação e filtros)' })
  @ApiResponse({ status: 200, description: 'Lista de alunos retornada.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  findAll(@Query() query: QueryBeneficiaryDto) {
    return this.beneficiariesService.findAll(query);
  }

  @Get('check-cpf-rg')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Verifica se um CPF ou RG já existe no sistema' })
  @ApiQuery({ name: 'cpf', required: false, description: 'CPF a verificar' })
  @ApiQuery({ name: 'rg', required: false, description: 'RG a verificar' })
  @ApiResponse({ status: 200, description: 'Resultado da verificação.' })
  @ApiResponse({ status: 400, description: 'Nenhum parâmetro informado.' })
  checkCpfRg(@Query('cpf') cpf?: string, @Query('rg') rg?: string) {
    if (!cpf && !rg) throw new BadRequestException('Informe o CPF ou o RG para verificação.');
    return this.beneficiariesService.checkCpfRg(cpf, rg);
  }

  @Get('export')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Exportar lista de alunos filtrada como planilha Excel (.xlsx)' })
  @ApiResponse({ status: 200, description: 'Planilha Excel gerada e enviada como download.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
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
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Aluno encontrado.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Atualizar dados de um aluno existente' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Aluno atualizado.' })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateBeneficiaryDto) {
    return this.beneficiariesService.update(id, dto, getAuditUser(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Inativar um aluno (Soft Delete)' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Aluno inativado.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.remove(id, getAuditUser(req));
  }

  @Post(':id/reactivate')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Reativar um aluno arquivado/inativo' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 201, description: 'Aluno reativado.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  reactivate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.reactivate(id, getAuditUser(req));
  }

  @Patch(':id/restore')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Restaurar um aluno inativado' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Aluno restaurado.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
  restore(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.beneficiariesService.restore(id, getAuditUser(req));
  }

  @Delete(':id/hard')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Arquivar aluno em exclusao logica profunda (nao remove fisicamente)' })
  @ApiParam({ name: 'id', description: 'UUID do aluno' })
  @ApiResponse({ status: 200, description: 'Aluno arquivado permanentemente.' })
  @ApiResponse({ status: 404, description: 'Aluno não encontrado.' })
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
