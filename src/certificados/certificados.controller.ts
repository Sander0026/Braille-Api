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
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CertificadosService } from './certificados.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Modelos de Certificados')
@ApiBearerAuth('access-token')
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
  @ApiResponse({ status: 201, description: 'PDF do certificado gerado. Retorna { pdfUrl, codigoValidacao }.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou aluno sem turma concluída.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  async gerarAcademico(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirAcademicoDto,
  ) {
    // Retorna JSON — pdfUrl aponta para Cloudinary (cache); frontend abre diretamente no viewer
    return this.certificadosService.emitirAcademico(dto, getAuditUser(req));
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
  @ApiResponse({ status: 201, description: 'Modelo criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Imagens obrigatórias ausentes ou tipo de arquivo inválido.' })
  @ApiResponse({ status: 413, description: 'Arquivo excede 10 MB.' })
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
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Lista todos os modelos de certificados' })
  @ApiResponse({ status: 200, description: 'Lista de modelos retornada.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  findAll() {
    return this.certificadosService.findAll();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Retorna um modelo de certificado pelo ID' })
  @ApiParam({ name: 'id', description: 'UUID do modelo de certificado' })
  @ApiResponse({ status: 200, description: 'Modelo encontrado.' })
  @ApiResponse({ status: 404, description: 'Modelo não encontrado.' })
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
  @ApiParam({ name: 'id', description: 'UUID do modelo de certificado' })
  @ApiResponse({ status: 200, description: 'Modelo atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Tipo de arquivo inválido.' })
  @ApiResponse({ status: 404, description: 'Modelo não encontrado.' })
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
  @ApiParam({ name: 'id', description: 'UUID do modelo de certificado' })
  @ApiResponse({ status: 200, description: 'Modelo deletado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Modelo não encontrado.' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.certificadosService.remove(id, getAuditUser(req));
  }
}
