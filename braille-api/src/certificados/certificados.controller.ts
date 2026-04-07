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
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { CertificadosService } from './certificados.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { PdfService } from './pdf.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Modelos de Certificados')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('modelos-certificados')
export class CertificadosController {
  constructor(
    private readonly certificadosService: CertificadosService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('teste')
  @ApiOperation({ summary: 'Rota temporária de homologação geométrica do PDF' })
  async gerarPdfTeste(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.pdfService.construirPdfBase(
      {
        arteBaseUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
        assinaturaUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
        assinaturaUrl2: null,
        layoutConfig: null,
        nomeAssinante: 'Assinante Demo',
        cargoAssinante: 'Cargo Demo',
        nomeAssinante2: null,
        cargoAssinante2: null,
      },
      'CERTIFICAMOS QUE\n\nAluno de Teste do Sistema Braille\n\nConcluiu com êxito o curso de testes.',
      'BR-TEST-01',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="teste_homologacao.pdf"',
    });
    return new StreamableFile(buffer);
  }

  @Post('emitir-academico')
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR')
  @ApiOperation({ summary: 'Emite o PDF de diploma para um Aluno Matriculado numa Turma Concluída.' })
  async gerarAcademico(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirAcademicoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.certificadosService.emitirAcademico(dto, getAuditUser(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="certificado_academico.pdf"',
    });
    return new StreamableFile(buffer);
  }

  @Post('emitir-honraria')
  @Roles('ADMIN', 'SECRETARIA')
  @ApiOperation({ summary: 'Emite o PDF de Amigo do Braille para terceiros.' })
  async gerarHonraria(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmitirHonrariaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.certificadosService.emitirHonraria(dto, getAuditUser(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="honorific_braille.pdf"',
    });
    return new StreamableFile(buffer);
  }

  @Post()
  @Roles('ADMIN', 'SECRETARIA')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'arteBase', maxCount: 1 },
      { name: 'assinatura', maxCount: 1 },
      { name: 'assinatura2', maxCount: 1 },
    ]),
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
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Roles('ADMIN', 'SECRETARIA', 'PROFESSOR', 'COMUNICACAO')
  @ApiOperation({ summary: 'Lista todos os modelos de certificados' })
  findAll() {
    return this.certificadosService.findAll();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
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
    ]),
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
