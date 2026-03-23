import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { ApoiadoresService } from './apoiadores.service';
import { CreateApoiadorDto, UpdateApoiadorDto } from './dto/apoiador.dto';
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
    @Query('search') search?: string
  ) {
    return this.apoiadoresService.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      tipo,
      search,
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

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN') // Apenas ADMIN pode deletar apoiadores (soft delete)
  remove(@Param('id') id: string) {
    return this.apoiadoresService.remove(id);
  }
}
