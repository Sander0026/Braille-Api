import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriaArquivoAtendimentoIndividual, Role } from '@prisma/client';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';
import { getAuditUser } from '../../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AtendimentosIndividuaisService } from '../services/atendimentos-individuais.service';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AnexarArquivoAtendimentoDto } from '../dto/anexar-arquivo-atendimento.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

@ApiTags('Atendimentos Individuais - Registros')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.PROFESSOR)
@SkipAudit()
@Controller('atendimentos-individuais')
export class AtendimentosIndividuaisController {
  constructor(private readonly service: AtendimentosIndividuaisService) {}

  @Post('acompanhamentos/:id/atendimentos')
  @ApiOperation({ summary: 'Criar registro de atendimento, falta ou cancelamento no acompanhamento' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  @ApiResponse({ status: 201, description: 'Atendimento registrado.' })
  @ApiResponse({ status: 409, description: 'Acompanhamento finalizado ou arquivado.' })
  create(
    @Param('id') acompanhamentoId: string,
    @Body() dto: CriarAtendimentoIndividualDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.criarAtendimento(acompanhamentoId, dto, req.user, getAuditUser(req));
  }

  @Get('acompanhamentos/:id/atendimentos')
  @ApiOperation({ summary: 'Listar registros de um acompanhamento individual' })
  @ApiParam({ name: 'id', description: 'UUID do acompanhamento' })
  findByAcompanhamento(@Param('id') acompanhamentoId: string, @Req() req: AuthenticatedRequest) {
    return this.service.listarAtendimentos(acompanhamentoId, req.user);
  }

  @Get('atendimentos/:id')
  @ApiOperation({ summary: 'Buscar atendimento individual por ID' })
  @ApiParam({ name: 'id', description: 'UUID do atendimento' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.buscarAtendimento(id, req.user);
  }

  @Post('atendimentos/:id/arquivos')
  @ApiOperation({
    summary: 'Anexar arquivo ao atendimento individual',
    description: 'Aceita PDF, PNG, JPG e JPEG com limite de 10 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: Object.values(CategoriaArquivoAtendimentoIndividual),
          example: CategoriaArquivoAtendimentoIndividual.ATESTADO,
        },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          callback(null, true);
          return;
        }

        callback(new BadRequestException('Tipo de arquivo nao permitido para atendimento individual.'), false);
      },
    }),
  )
  anexarArquivo(
    @Param('id') atendimentoId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AnexarArquivoAtendimentoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.service.anexarArquivo(
      atendimentoId,
      file,
      dto.categoria ?? CategoriaArquivoAtendimentoIndividual.OUTRO,
      req.user,
      getAuditUser(req),
    );
  }
}
