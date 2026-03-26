import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { PdfService } from './pdf.service';
import { randomBytes } from 'node:crypto';

@Injectable()
export class CertificadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly pdfService: PdfService,
  ) {}

  async create(createDto: CreateCertificadoDto, arteBaseFile?: Express.Multer.File, assinaturaFile?: Express.Multer.File, assinatura2File?: Express.Multer.File) {
    let arteBaseUrl = '';
    let assinaturaUrl = '';
    let assinaturaUrl2: string | null = null;

    if (arteBaseFile) {
      const uploadBase = await this.uploadService.uploadImage(arteBaseFile);
      arteBaseUrl = uploadBase.url;
    }

    if (assinaturaFile) {
      const uploadAssinatura = await this.uploadService.uploadImage(assinaturaFile);
      assinaturaUrl = uploadAssinatura.url;
    }

    if (assinatura2File) {
      const uploadAssinatura2 = await this.uploadService.uploadImage(assinatura2File);
      assinaturaUrl2 = uploadAssinatura2.url;
    }

    let parsedLayout: any = undefined;
    if (createDto.layoutConfig) {
      try { parsedLayout = JSON.parse(createDto.layoutConfig); } catch (e) {}
    }

    return this.prisma.modeloCertificado.create({
      data: {
        ...createDto,
        layoutConfig: parsedLayout,
        arteBaseUrl,
        assinaturaUrl,
        assinaturaUrl2,
      },
    });
  }

  async findAll() {
    return this.prisma.modeloCertificado.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string) {
    const modelo = await this.prisma.modeloCertificado.findUnique({
      where: { id },
    });
    if (!modelo) throw new NotFoundException('Modelo de certificado não encontrado.');
    return modelo;
  }

  async update(
    id: string,
    updateDto: UpdateCertificadoDto,
    arteBaseFile?: Express.Multer.File,
    assinaturaFile?: Express.Multer.File,
    assinatura2File?: Express.Multer.File,
  ) {
    const modelo = await this.findOne(id);

    let arteBaseUrl = modelo.arteBaseUrl;
    let assinaturaUrl = modelo.assinaturaUrl;
    let assinaturaUrl2 = modelo.assinaturaUrl2;

    if (arteBaseFile) {
      if (modelo.arteBaseUrl) await this.uploadService.deleteFile(modelo.arteBaseUrl);
      const uploadBase = await this.uploadService.uploadImage(arteBaseFile);
      arteBaseUrl = uploadBase.url;
    }

    if (assinaturaFile) {
      if (modelo.assinaturaUrl) await this.uploadService.deleteFile(modelo.assinaturaUrl);
      const uploadAssinatura = await this.uploadService.uploadImage(assinaturaFile);
      assinaturaUrl = uploadAssinatura.url;
    }

    if (assinatura2File) {
      if (modelo.assinaturaUrl2) await this.uploadService.deleteFile(modelo.assinaturaUrl2);
      const uploadAssinatura2 = await this.uploadService.uploadImage(assinatura2File);
      assinaturaUrl2 = uploadAssinatura2.url;
    }

    let parsedLayout: any = undefined;
    if (updateDto.layoutConfig) {
      try { parsedLayout = JSON.parse(updateDto.layoutConfig); } catch (e) {}
    } else if (updateDto.layoutConfig === '') {
      parsedLayout = null; // caso apague
    }

    return this.prisma.modeloCertificado.update({
      where: { id },
      data: {
        ...updateDto,
        layoutConfig: parsedLayout !== undefined ? parsedLayout : undefined,
        arteBaseUrl,
        assinaturaUrl,
        assinaturaUrl2,
      },
    });
  }

  async remove(id: string) {
    const modelo = await this.findOne(id);
    
    if (modelo.arteBaseUrl) {
      await this.uploadService.deleteFile(modelo.arteBaseUrl);
    }
    
    if (modelo.assinaturaUrl) {
      await this.uploadService.deleteFile(modelo.assinaturaUrl);
    }

    if (modelo.assinaturaUrl2) {
      await this.uploadService.deleteFile(modelo.assinaturaUrl2);
    }

    return this.prisma.modeloCertificado.delete({
      where: { id },
    });
  }

  // ============== LÓGICAS DE EMISSÃO ==============

  async emitirAcademico(dto: EmitirAcademicoDto) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: dto.turmaId },
      include: { modeloCertificado: true, matriculasOficina: { where: { alunoId: dto.alunoId } } },
    });

    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.status !== 'CONCLUIDA') throw new BadRequestException('A turma precisa estar CONCLUIDA para emitir certificados.');
    if (!turma.modeloCertificadoId || !turma.modeloCertificado) throw new BadRequestException('A Turma não possui um Modelo de Certificado configurado.');

    if (turma.matriculasOficina.length === 0) {
      throw new BadRequestException('O Aluno não cursa ou não está matriculado nesta turma.');
    }

    // ── Verificação de Frequência Mínima (≥ 75%) ──────────────────────────
    // Compatibilidade: registros antigos usam `presente: true` (campo legado);
    // registros novos usam `status: PRESENTE | FALTA_JUSTIFICADA`.
    // O OR garante que ambos os formatos sejam reconhecidos como presença.
    const totalAulas = await this.prisma.frequencia.count({
      where: { turmaId: dto.turmaId, alunoId: dto.alunoId },
    });
    if (totalAulas > 0) {
      const presencas = await this.prisma.frequencia.count({
        where: {
          turmaId: dto.turmaId,
          alunoId: dto.alunoId,
          OR: [
            { presente: true },
            { status: { in: ['PRESENTE', 'FALTA_JUSTIFICADA'] } },
          ],
        },
      });
      const taxaPresenca = Math.round((presencas / totalAulas) * 100);
      if (taxaPresenca < 75) {
        throw new BadRequestException(
          `O aluno possui apenas ${taxaPresenca}% de frequência. É necessário pelo menos 75% para emitir o certificado.`,
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const aluno = await this.prisma.aluno.findUnique({ where: { id: dto.alunoId } });
    if (!aluno) throw new NotFoundException('Aluno inativo ou não encontrado.');

    // Substituição de Tags
    const cargaHr = turma.cargaHoraria || 'Não informada';
    const dataInic = turma.dataInicio ? turma.dataInicio.toLocaleDateString('pt-BR') : 'Data Indefinida';
    const dataFim = turma.dataFim ? turma.dataFim.toLocaleDateString('pt-BR') : 'Data Indefinida';

    const textoPronto = turma.modeloCertificado.textoTemplate
      .replace(/{{ALUNO}}/g, aluno.nomeCompleto)
      .replace(/{{TURMA}}/g, turma.nome)
      .replace(/{{CARGA_HORARIA}}/g, cargaHr)
      .replace(/{{DATA_INICIO}}/g, dataInic)
      .replace(/{{DATA_FIM}}/g, dataFim);

    const hashUnique = randomBytes(4).toString('hex').toUpperCase();

    // Registra emissão no Banco para a verificação pública ter prova
    await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        alunoId: aluno.id,
        turmaId: turma.id,
        modeloId: turma.modeloCertificado.id,
      }
    });

    // Pinta o PDF — passa nomeAluno para renderizar a tag posicionável {{NOME_ALUNO}}
    const buffer = await this.pdfService.construirPdfBase(
      turma.modeloCertificado as any,
      textoPronto,
      hashUnique,
      aluno.nomeCompleto,
    );
    return buffer;
  }

  async emitirHonraria(dto: EmitirHonrariaDto) {
    const modelo = await this.prisma.modeloCertificado.findUnique({
      where: { id: dto.modeloId }
    });

    if (!modelo) throw new NotFoundException('Modelo de certificado não encontrado.');
    if (modelo.tipo !== 'HONRARIA') throw new BadRequestException('O Modelo informado não é do tipo HONRARIA.');

    const textoPronto = modelo.textoTemplate
      .replace(/{{PARCEIRO}}/g, dto.nomeParceiro)
      .replace(/{{MOTIVO}}/g, dto.motivo)
      .replace(/{{DATA}}/g, dto.dataEmissao);

    const hashUnique = randomBytes(4).toString('hex').toUpperCase();

    await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        modeloId: modelo.id,
      }
    });

    const buffer = await this.pdfService.construirPdfBase(
      modelo as any,
      textoPronto,
      hashUnique
    );
    return buffer;
  }

  async validarPublico(codigo: string) {
    const emissao = await this.prisma.certificadoEmitido.findUnique({
      where: { codigoValidacao: codigo },
      include: {
        aluno: { select: { nomeCompleto: true } },
        turma: { select: { nome: true } },
        modelo: { select: { nome: true, tipo: true } }
      }
    });

    if (!emissao) {
      throw new NotFoundException('Certificado não encontrado ou código de validação inválido.');
    }

    let nomeOut = 'Parceiro Institucional / Apoiador';
    let cursoOut = emissao.modelo.nome;

    if (emissao.modelo.tipo === 'ACADEMICO' && emissao.aluno && emissao.turma) {
      nomeOut = emissao.aluno.nomeCompleto;
      cursoOut = emissao.turma.nome;
    }

    return {
      valido: true,
      nome: nomeOut,
      curso: cursoOut,
      data: emissao.dataEmissao.toLocaleDateString('pt-BR'),
      tipo: emissao.modelo.tipo
    };
  }
}
