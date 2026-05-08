import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  BadRequestException,
  StreamableFile,
  Res,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiProduces, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CertificadosService } from './certificados.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { CancelarCertificadoDto } from './dto/cancelar-certificado.dto';
import { EmitirManualAcademicoDto } from './dto/emitir-manual-academico.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Modelos de Certificados')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@SkipAudit()
@Controller('modelos-certificados')
export class CertificadosController {
  constructor(private readonly certificadosService: CertificadosService) {}

  private static readonly cloudinaryMaxFileSize = 10 * 1024 * 1024;

  private static readonly imageUploadInterceptorOptions = {
    storage: memoryStorage(),
    limits: { fileSize: CertificadosController.cloudinaryMaxFileSize },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      if (isImage) {
        callback(null, true);
        return;
      }

      callback(
        new BadRequestException('Tipo de arquivo não suportado. Envie apenas imagens JPG, PNG ou WebP.'),
        false,
      );
    },
  };

  @Post('emitir-academico')
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR')
  @ApiOperation({ summary: 'Emite (ou recupera do cache) o certificado acadêmico. Retorna { pdfUrl, codigoValidacao }.' })
  @ApiResponse({ status: 201, description: 'Certificado academico emitido ou recuperado com sucesso.' })
  async gerarAcademico(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirAcademicoDto,
  ) {
    // Retorna JSON — pdfUrl aponta para Cloudinary (cache); frontend abre diretamente no viewer
    return this.certificadosService.emitirAcademico(dto, getAuditUser(req));
  }

  @Post('emitir-manual-academico')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Emite certificado academico manual com dados informados pelo usuario.' })
  @ApiResponse({ status: 201, description: 'Certificado academico manual emitido e vinculado ao aluno/turma.' })
  gerarManualAcademico(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirManualAcademicoDto,
  ) {
    return this.certificadosService.emitirManualAcademico(dto, getAuditUser(req));
  }

  @Post('emitir-honraria')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Emite o PDF de Amigo do Braille para terceiros.' })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 201,
    description: 'PDF da honraria. O codigo de validacao e retornado no header X-Codigo-Validacao.',
  })
  async gerarHonraria(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirHonrariaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdfBuffer, codigoValidacao } = await this.certificadosService.emitirHonraria(dto, getAuditUser(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="honorific_braille.pdf"',
      'X-Codigo-Validacao': codigoValidacao,
    });
    return new StreamableFile(pdfBuffer);
  }

  @Post(':id/preview-pdf')
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Gera uma prévia PDF real do modelo sem emitir certificado.' })
  @ApiProduces('application/pdf')
  @ApiParam({ name: 'id', description: 'UUID do modelo de certificado' })
  @ApiResponse({ status: 201, description: 'PDF de prévia gerado pelo mesmo motor da emissão final.' })
  async previewPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfBuffer = await this.certificadosService.gerarPreviewPdfModelo(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview-certificado.pdf"',
    });
    return new StreamableFile(pdfBuffer);
  }

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'arteBase', maxCount: 1 },
      { name: 'assinatura', maxCount: 1 },
      { name: 'assinatura2', maxCount: 1 },
    ], CertificadosController.imageUploadInterceptorOptions),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cria um novo modelo de certificado' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateCertificadoDto,
    @UploadedFiles()
    files: {
      arteBase?: Express.Multer.File[];
      assinatura?: Express.Multer.File[];
      assinatura2?: Express.Multer.File[];
    },
  ) {
    const arteBaseFile = files?.arteBase?.[0];
    const assinaturaFile = files?.assinatura?.[0];
    const assinatura2File = files?.assinatura2?.[0];

    if (!arteBaseFile || !assinaturaFile) {
      throw new BadRequestException('As imagens da arteBase e da assinatura principal são obrigatórias na criação.');
    }

    return this.certificadosService.create(createDto, arteBaseFile, assinaturaFile, assinatura2File, getAuditUser(req));
  }

  @Get()
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Lista todos os modelos de certificados' })
  findAll() {
    return this.certificadosService.findAll();
  }

  @Patch('certificados/:id/cancelar')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Cancela um certificado emitido e torna a validacao publica invalida' })
  @ApiParam({ name: 'id', description: 'UUID do certificado emitido a cancelar' })
  @ApiResponse({ status: 200, description: 'Certificado cancelado com historico/auditoria.' })
  cancelarCertificado(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelarCertificadoDto,
  ) {
    return this.certificadosService.cancelarCertificado(id, dto, getAuditUser(req));
  }

  @Post('certificados/:id/reemitir')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Reemite um certificado academico, criando nova versao e invalidando a anterior' })
  @ApiParam({ name: 'id', description: 'UUID do certificado emitido a reemitir' })
  @ApiResponse({ status: 201, description: 'Nova versao do certificado criada e versao anterior marcada como REISSUED.' })
  reemitirCertificado(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.certificadosService.reemitirCertificado(id, getAuditUser(req));
  }

  @Get(':id')
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Retorna um modelo de certificado pelo ID' })
  findOne(@Param('id') id: string) {
    return this.certificadosService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'arteBase', maxCount: 1 },
      { name: 'assinatura', maxCount: 1 },
      { name: 'assinatura2', maxCount: 1 },
    ], CertificadosController.imageUploadInterceptorOptions),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Atualiza um modelo de certificado (texto e/ou imagens)' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateCertificadoDto,
    @UploadedFiles()
    files?: {
      arteBase?: Express.Multer.File[];
      assinatura?: Express.Multer.File[];
      assinatura2?: Express.Multer.File[];
    },
  ) {
    const arteBaseFile = files?.arteBase?.[0];
    const assinaturaFile = files?.assinatura?.[0];
    const assinatura2File = files?.assinatura2?.[0];

    return this.certificadosService.update(
      id,
      updateDto,
      arteBaseFile,
      assinaturaFile,
      assinatura2File,
      getAuditUser(req),
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Deleta um modelo e remove os arquivos do Cloudinary' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.certificadosService.remove(id, getAuditUser(req));
  }
}
