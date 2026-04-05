import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { PdfService } from './pdf.service';
import { ImageProcessingService } from './image-processing.service';
import { randomBytes } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAcao } from '@prisma/client';

export interface AuditUserParams {
  autorId?: string;
  autorNome?: string;
  autorRole?: string;
}

@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly pdfService: PdfService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly auditService: AuditLogService,
  ) {}

  /** Processa assinatura (remove fundo branco) e faz upload como PNG transparente */
  private async uploadAssinatura(file: Express.Multer.File) {
    const pngBuffer = await this.imageProcessing.removerFundoBrancoAssinatura(file.buffer);
    const pngFile: Express.Multer.File = {
      ...file,
      buffer: pngBuffer,
      mimetype: 'image/png',
      originalname: file.originalname.replace(/\.[^.]+$/, '.png'),
    };
    return this.uploadService.uploadImage(pngFile);
  }

  async create(createDto: CreateCertificadoDto, arteBaseFile?: Express.Multer.File, assinaturaFile?: Express.Multer.File, assinatura2File?: Express.Multer.File, auditUser?: AuditUserParams) {
    let arteBaseUrl = '';
    let assinaturaUrl = '';
    let assinaturaUrl2: string | null = null;

    if (arteBaseFile) {
      const uploadBase = await this.uploadService.uploadImage(arteBaseFile);
      arteBaseUrl = uploadBase.url;
    }

    if (assinaturaFile) {
      const uploadAssinatura = await this.uploadAssinatura(assinaturaFile);
      assinaturaUrl = uploadAssinatura.url;
    }

    if (assinatura2File) {
      const uploadAssinatura2 = await this.uploadAssinatura(assinatura2File);
      assinaturaUrl2 = uploadAssinatura2.url;
    }

    let parsedLayout: any = undefined;
    if (createDto.layoutConfig) {
      try { 
        parsedLayout = JSON.parse(createDto.layoutConfig); 
      } catch (e: unknown) {
        const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
        this.logger.warn(`Erro no parsing silencioso do layoutConfig (Create): ${erroMsg}`);
      }
    }

    const novoModelo = await this.prisma.modeloCertificado.create({
      data: {
        ...createDto,
        layoutConfig: parsedLayout,
        arteBaseUrl,
        assinaturaUrl,
        assinaturaUrl2,
      },
    });

    this.auditService.registrar({
      ...auditUser,
      entidade: 'ModeloCertificado',
      registroId: novoModelo.id,
      acao: AuditAcao.CRIAR,
      newValue: novoModelo,
    });

    return novoModelo;
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
    auditUser?: AuditUserParams
  ) {
    const modelo = await this.findOne(id);

    let arteBaseUrl = modelo.arteBaseUrl;
    let assinaturaUrl = modelo.assinaturaUrl;
    let assinaturaUrl2 = modelo.assinaturaUrl2;

    if (arteBaseFile) {
      if (modelo.arteBaseUrl) {
        try {
          await this.uploadService.deleteFile(modelo.arteBaseUrl);
        } catch (e: unknown) {
          const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
          this.logger.warn(`Falha soft ao excluir arteBaseUrl antiga no Cloudinary: ${erroMsg}`);
        }
      }
      const uploadBase = await this.uploadService.uploadImage(arteBaseFile);
      arteBaseUrl = uploadBase.url;
    }

    if (assinaturaFile) {
      if (modelo.assinaturaUrl) {
        try {
          await this.uploadService.deleteFile(modelo.assinaturaUrl);
        } catch (e: unknown) {
          const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
          this.logger.warn(`Falha soft ao excluir assinaturaUrl antiga no Cloudinary: ${erroMsg}`);
        }
      }
      const uploadAssinatura = await this.uploadAssinatura(assinaturaFile);
      assinaturaUrl = uploadAssinatura.url;
    }

    if (assinatura2File) {
      if (modelo.assinaturaUrl2) {
        try {
          await this.uploadService.deleteFile(modelo.assinaturaUrl2);
        } catch (e: unknown) {
          const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
          this.logger.warn(`Falha soft ao excluir assinaturaUrl2 antiga no Cloudinary: ${erroMsg}`);
        }
      }
      const uploadAssinatura2 = await this.uploadAssinatura(assinatura2File);
      assinaturaUrl2 = uploadAssinatura2.url;
    }

    let parsedLayout: any = undefined;
    if (updateDto.layoutConfig) {
      try { 
        parsedLayout = JSON.parse(updateDto.layoutConfig); 
      } catch (e: unknown) {
        const erroMsg = e instanceof Error ? e.message : 'Erro genérico';
        this.logger.warn(`Erro no parsing silencioso do layoutConfig (Update): ${erroMsg}`);
      }
    } else if (updateDto.layoutConfig === '') {
      parsedLayout = null; // caso apague
    }

    const modeloAtualizado = await this.prisma.modeloCertificado.update({
      where: { id },
      data: {
        ...updateDto,
        layoutConfig: parsedLayout !== undefined ? parsedLayout : undefined,
        arteBaseUrl,
        assinaturaUrl,
        assinaturaUrl2,
      },
    });

    this.auditService.registrar({
      ...auditUser,
      entidade: 'ModeloCertificado',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      oldValue: modelo,
      newValue: modeloAtualizado,
    });

    return modeloAtualizado;
  }

  async remove(id: string, auditUser?: AuditUserParams) {
    const modelo = await this.findOne(id);
    
    if (modelo.arteBaseUrl) {
      try {
        await this.uploadService.deleteFile(modelo.arteBaseUrl);
      } catch (e: unknown) {
        this.logger.warn('Soft fail no delete arteBaseUrl: arquivo não afetou a exclusão.');
      }
    }
    
    if (modelo.assinaturaUrl) {
      try {
        await this.uploadService.deleteFile(modelo.assinaturaUrl);
      } catch (e: unknown) {
        this.logger.warn('Soft fail no delete assinaturaUrl: arquivo não afetou a exclusão.');
      }
    }

    if (modelo.assinaturaUrl2) {
      try {
        await this.uploadService.deleteFile(modelo.assinaturaUrl2);
      } catch (e: unknown) {
        this.logger.warn('Soft fail no delete assinaturaUrl2: arquivo não afetou a exclusão.');
      }
    }

    const excluido = await this.prisma.modeloCertificado.delete({
      where: { id },
    });

    this.auditService.registrar({
      ...auditUser,
      entidade: 'ModeloCertificado',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      oldValue: modelo,
      newValue: null as any,
    });

    return excluido;
  }

  // ============== LÓGICAS DE EMISSÃO ==============

  async emitirAcademico(dto: EmitirAcademicoDto, auditUser?: AuditUserParams) {
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
    const certificadoEmitido = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        alunoId: aluno.id,
        turmaId: turma.id,
        modeloId: turma.modeloCertificado.id,
      }
    });

    this.auditService.registrar({
      ...auditUser,
      entidade: 'CertificadoEmitido',
      registroId: certificadoEmitido.id,
      acao: AuditAcao.CRIAR,
      newValue: certificadoEmitido,
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

  async emitirHonraria(dto: EmitirHonrariaDto, auditUser?: AuditUserParams) {
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

    const emissao = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        modeloId: modelo.id,
      }
    });

    this.auditService.registrar({
      ...auditUser,
      entidade: 'CertificadoEmitido',
      registroId: emissao.id,
      acao: AuditAcao.CRIAR,
      newValue: emissao,
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
