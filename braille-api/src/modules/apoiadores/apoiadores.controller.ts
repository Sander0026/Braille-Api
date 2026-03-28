import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ApoiadoresService } from './apoiadores.service';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { TipoApoiador } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../../upload/upload.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('apoiadores')
export class ApoiadoresController {
  constructor(
    private readonly apoiadoresService: ApoiadoresService,
    private readonly uploadService: UploadService
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  create(@Body() createApoiadorDto: CreateApoiadorDto) {
    return this.apoiadoresService.create(createApoiadorDto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('tipo') tipo?: TipoApoiador,
    @Query('search') search?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.apoiadoresService.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      tipo,
      search,
      ativo: ativo !== undefined ? ativo !== 'false' : undefined,
    });
  }

  @Get('publicos')
  findPublic() {
    return this.apoiadoresService.findPublic();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  findOne(@Param('id') id: string) {
    return this.apoiadoresService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  update(@Param('id') id: string, @Body() updateApoiadorDto: UpdateApoiadorDto) {
    return this.apoiadoresService.update(id, updateApoiadorDto);
  }

  @Patch(':id/logo')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    
    // Verifica se apoiador existe antes do upload
    await this.apoiadoresService.findOne(id);
    
    // Upload via UploadService existente no projeto
    const uploaded = await this.uploadService.uploadImage(file);
    
    return this.apoiadoresService.updateLogo(id, uploaded.url);
  }

  @Patch(':id/inativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  inativar(@Param('id') id: string) {
    return this.apoiadoresService.inativar(id);
  }

  @Patch(':id/reativar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  reativar(@Param('id') id: string) {
    return this.apoiadoresService.reativar(id);
  }

  // ---- Histórico de Ações (Tracking Relacional) ----
  
  @Post(':id/acoes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  addAcao(
    @Param('id') id: string, 
    @Body() dto: CreateAcaoApoiadorDto
  ) {
    return this.apoiadoresService.addAcao(id, dto);
  }

  @Patch(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  updateAcao(
    @Param('id') id: string,
    @Param('acaoId') acaoId: string,
    @Body() dto: UpdateAcaoApoiadorDto
  ) {
    return this.apoiadoresService.updateAcao(id, acaoId, dto);
  }

  @Get(':id/acoes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  getAcoes(@Param('id') id: string) {
    return this.apoiadoresService.getAcoes(id);
  }

  @Delete(':id/acoes/:acaoId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  removeAcao(@Param('id') id: string, @Param('acaoId') acaoId: string) {
    return this.apoiadoresService.removeAcao(id, acaoId);
  }

  // ---- Certificados da Parte de Honrarias ----

  @Post(':id/certificados')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  emitirCertificado(
    @Param('id') id: string,
    @Body() emitirDto: EmitirCertificadoApoiadorDto,
  ) {
    return this.apoiadoresService.emitirCertificado(id, emitirDto);
  }

  @Get(':id/certificados')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  getCertificados(@Param('id') id: string) {
    return this.apoiadoresService.getCertificados(id);
  }

  @Get(':id/certificados/:certId/pdf')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'COMUNICACAO', 'SECRETARIA')
  async getPdfCertificado(
    @Param('id') id: string,
    @Param('certId') certId: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.apoiadoresService.gerarPdfCertificado(id, certId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificado-${certId}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (err: any) {
      // Sinal especial: modelo excluído mas PDF persistido no Cloudinary
      if (err instanceof NotFoundException && err.message?.startsWith('__USE_PDF_URL__:')) {
        const pdfUrl = err.message.replace('__USE_PDF_URL__:', '');
        res.redirect(301, pdfUrl);
        return;
      }
      throw err;
    }
  }
}

