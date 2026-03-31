import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { Prisma, TipoApoiador, AuditAcao } from '@prisma/client';
import { PdfService } from '../certificados/pdf.service';
import { UploadService } from '../upload/upload.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as crypto from 'node:crypto';

export interface AuditUserParams {
  sub: string;
  nome: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ApoiadoresService {
  private readonly logger = new Logger(ApoiadoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditLogService,
  ) {}

  async create(createApoiadorDto: CreateApoiadorDto, auditUser?: AuditUserParams) {
    const { acoes, ...rest } = createApoiadorDto;
    const result = await this.prisma.apoiador.create({
      data: {
        ...rest,
        acoes: acoes && acoes.length > 0 ? { create: acoes } : undefined,
      },
    });

    if (auditUser) {
      this.auditService.registrar({
        entidade: 'Apoiador',
        registroId: result.id,
        acao: AuditAcao.CRIAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        newValue: result,
      }).catch(e => this.logger.warn(`Auditoria falhou em create Apoiador: ${e.message}`));
    }
    
    return result;
  }

  async findAll(params: { skip?: number; take?: number; tipo?: TipoApoiador; search?: string; ativo?: boolean }) {
    const { skip, take, tipo, search, ativo } = params;
    const where: Prisma.ApoiadorWhereInput = {};

    // Por padrão lista apenas ativos; passa ativo=false para listar inativos
    if (ativo === undefined) {
      where.ativo = true; // comportamento padrão
    } else {
      where.ativo = ativo;
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (search) {
      where.OR = [
        { nomeRazaoSocial: { contains: search, mode: 'insensitive' } },
        { nomeFantasia: { contains: search, mode: 'insensitive' } },
        { atividadeEspecialidade: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [apoiadores, total] = await Promise.all([
      this.prisma.apoiador.findMany({
        skip,
        take,
        where,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.apoiador.count({ where }),
    ]);

    return { total, data: apoiadores };
  }

  async findPublic() {
    return this.prisma.apoiador.findMany({
      where: {
        ativo: true,
        exibirNoSite: true,
      },
      orderBy: { nomeRazaoSocial: 'asc' },
    });
  }

  async findOne(id: string) {
    const apoiador = await this.prisma.apoiador.findUnique({
      where: { id },
    });
    if (!apoiador) {
      throw new NotFoundException(`Apoiador com ID ${id} não encontrado`);
    }
    return apoiador;
  }

  async update(id: string, updateApoiadorDto: UpdateApoiadorDto, auditUser?: AuditUserParams) {
    const { acoes, ...rest } = updateApoiadorDto;
    const oldApoiador = await this.findOne(id);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: rest,
    });

    if (auditUser) {
      this.auditService.registrar({
        entidade: 'Apoiador',
        registroId: id,
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: oldApoiador,
        newValue: result,
      }).catch(e => this.logger.warn(`Auditoria falhou em update Apoiador: ${e.message}`));
    }

    return result;
  }

  async updateLogo(id: string, logoUrl: string, auditUser?: AuditUserParams) {
    const oldApoiador = await this.findOne(id);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { logoUrl },
    });

    if (auditUser) {
      this.auditService.registrar({
        entidade: 'Apoiador',
        registroId: id,
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: { logoUrl: oldApoiador.logoUrl },
        newValue: { logoUrl: result.logoUrl },
      }).catch(e => this.logger.warn(`Auditoria falhou em updateLogo Apoiador: ${e.message}`));
    }

    return result;
  }

  // ---- Histórico de Ações (Tracking Relacional) ----
  async addAcao(apoiadorId: string, dto: CreateAcaoApoiadorDto, auditUser?: AuditUserParams) {
    await this.findOne(apoiadorId); // garante existencia
    const acao = await this.prisma.acaoApoiador.create({
      data: {
        dataEvento: new Date(dto.dataEvento), // Força a deserialização da string vinda do POST
        descricaoAcao: dto.descricaoAcao,
        apoiadorId,
      },
    });

    if (dto.modeloCertificadoId) {
      await this.emitirCertificado(apoiadorId, {
        modeloId: dto.modeloCertificadoId,
        acaoId: acao.id,
        motivoPersonalizado: dto.motivoPersonalizado || dto.descricaoAcao,
        dataEmissao: dto.dataEvento,
      }, auditUser);
    }
    
    if (auditUser) {
      this.auditService.registrar({
        entidade: 'AcaoApoiador',
        registroId: acao.id,
        acao: AuditAcao.CRIAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        newValue: acao,
      }).catch(e => this.logger.warn(`Auditoria falhou em addAcao: ${e.message}`));
    }

    return acao;
  }
  
  async updateAcao(apoiadorId: string, acaoId: string, dto: UpdateAcaoApoiadorDto, auditUser?: AuditUserParams) {
    await this.findOne(apoiadorId);
    const acao = await this.prisma.acaoApoiador.findFirst({
      where: { id: acaoId, apoiadorId },
    });
    if (!acao) throw new NotFoundException('Ação não encontrada nesse perfil.');

    const acaoAtualizada = await this.prisma.acaoApoiador.update({
      where: { id: acaoId },
      data: {
        dataEvento: new Date(dto.dataEvento),
        descricaoAcao: dto.descricaoAcao,
      },
    });

    // Se forneceu um modeloId, então recarrega (deleta qualquer antigo, recria)
    if (dto.modeloCertificadoId) {
       await this.prisma.certificadoEmitido.deleteMany({
         where: { acaoId: acaoId }
       });
       
       await this.emitirCertificado(apoiadorId, {
         modeloId: dto.modeloCertificadoId,
         acaoId: acaoId,
         motivoPersonalizado: dto.motivoPersonalizado || dto.descricaoAcao,
         dataEmissao: dto.dataEvento,
       }, auditUser);
    }
    
    if (auditUser) {
      this.auditService.registrar({
        entidade: 'AcaoApoiador',
        registroId: acao.id,
        acao: AuditAcao.ATUALIZAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: acao,
        newValue: acaoAtualizada,
      }).catch(e => this.logger.warn(`Auditoria falhou em updateAcao: ${e.message}`));
    }

    return acaoAtualizada;
  }

  async getAcoes(apoiadorId: string) {
    await this.findOne(apoiadorId);
    return this.prisma.acaoApoiador.findMany({
      where: { apoiadorId },
      orderBy: { dataEvento: 'desc' },
    });
  }

  async removeAcao(apoiadorId: string, acaoId: string, auditUser?: AuditUserParams) {
    const acao = await this.prisma.acaoApoiador.findFirst({
      where: { id: acaoId, apoiadorId },
    });
    if (!acao) throw new NotFoundException('Ação não encontrada nesse perfil.');

    // Exclui certificados vinculados a esta ação primeiro (cascade logic)
    await this.prisma.certificadoEmitido.deleteMany({
      where: { acaoId: acaoId }
    });

    await this.prisma.acaoApoiador.delete({
      where: { id: acaoId },
    });
    
    if (auditUser) {
      this.auditService.registrar({
        entidade: 'AcaoApoiador',
        registroId: acao.id,
        acao: AuditAcao.EXCLUIR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: acao,
        newValue: null,
      }).catch(e => this.logger.warn(`Auditoria falhou ao excluir acaoApoiador: ${e.message}`));
    }
  }

  async inativar(id: string, auditUser?: AuditUserParams) {
    await this.findOne(id);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { ativo: false, exibirNoSite: false },
    });
    
    if (auditUser) {
      this.auditService.registrar({
        entidade: 'Apoiador',
        registroId: id,
        acao: AuditAcao.MUDAR_STATUS,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: { ativo: true, exibirNoSite: true },
        newValue: { ativo: false, exibirNoSite: false },
      }).catch(e => this.logger.warn(`Auditoria falhou em inativar Apoiador: ${e.message}`));
    }

    return result;
  }

  async reativar(id: string, auditUser?: AuditUserParams) {
    const apoiador = await this.prisma.apoiador.findUnique({ where: { id } });
    if (!apoiador) throw new NotFoundException(`Apoiador com ID ${id} não encontrado`);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { ativo: true, exibirNoSite: true },
    });

    if (auditUser) {
      this.auditService.registrar({
        entidade: 'Apoiador',
        registroId: id,
        acao: AuditAcao.RESTAURAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue: { ativo: apoiador.ativo, exibirNoSite: apoiador.exibirNoSite },
        newValue: { ativo: true, exibirNoSite: true },
      }).catch(e => this.logger.warn(`Auditoria falhou em reativar Apoiador: ${e.message}`));
    }
    
    return result;
  }

  // ---- Certificados (Honrarias) ----

  async emitirCertificado(apoiadorId: string, dto: EmitirCertificadoApoiadorDto, auditUser?: AuditUserParams) {
    const apoiador = await this.findOne(apoiadorId);
    
    const modelo = await this.prisma.modeloCertificado.findUnique({
      where: { id: dto.modeloId },
    });

    if (!modelo) {
      throw new NotFoundException('Modelo de certificado não encontrado.');
    }

    const codigoValidacao = crypto.randomBytes(6).toString('hex').toUpperCase();
    const dataEmissaoStr = dto.dataEmissao || new Date().toISOString();

    const nomeDestinatario = apoiador.nomeFantasia || apoiador.nomeRazaoSocial || 'Apoiador';

    // Formata a data sem erro de timezone: "2026-03-27" → "27/03/2026"
    const formatarDataSemTimezone = (isoStr: string): string => {
      const partes = isoStr.split('T')[0].split('-');
      if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
      return new Date(isoStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };

    const dataEmissaoFormatada = formatarDataSemTimezone(dataEmissaoStr);

    // Substituição das tags no template do modelo
    // Suporta múltiplas variações de nome e data para compatibilidade com templates
    const textoFormatado = (modelo.textoTemplate || '')
      .replaceAll('{{ALUNO}}', nomeDestinatario)
      .replaceAll('{{NOME}}', nomeDestinatario)
      .replaceAll('{{APOIADOR}}', nomeDestinatario)
      .replaceAll('{{PARCEIRO}}', nomeDestinatario)
      .replaceAll('{{NOME_APOIADOR}}', nomeDestinatario)
      .replaceAll('{{MOTIVO}}', dto.motivoPersonalizado || '')
      .replaceAll('{{DATA_EMISSAO}}', dataEmissaoFormatada)
      .replaceAll('{{DATA_EVENTO}}', dataEmissaoFormatada)
      .replaceAll('{{DATA}}', dataEmissaoFormatada);

    // O 4º parâmetro é o "nomeAluno" que é desenhado usando fonte cursiva (se configurado no modelo)
    const pdfBuffer = await this.pdfService.construirPdfBase(
      modelo,
      textoFormatado,
      codigoValidacao,
      nomeDestinatario
    );

    // Faz upload do PDF para o Cloudinary e persiste a URL
    let pdfUrl: string | null = null;
    try {
      const fileName = `certificado-${codigoValidacao}.pdf`;
      const uploaded = await this.uploadService.uploadPdfBuffer(pdfBuffer, fileName);
      pdfUrl = uploaded.url;
    } catch (uploadErr) {
      this.logger.error(`[CertificadoEmitido] Falha no upload para o Cloudinary, pdfUrl não salvo: ${uploadErr}`);
    }

    const pdfBase64 = pdfBuffer.toString('base64');

    const certificado = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao,
        modeloId: modelo.id,
        apoiadorId: apoiador.id,
        acaoId: dto.acaoId || null,
        motivoPersonalizado: dto.motivoPersonalizado || null,
        dataEmissao: new Date(dataEmissaoStr),
        pdfUrl,
      },
    });

    if (auditUser) {
      this.auditService.registrar({
        entidade: 'CertificadoEmitido',
        registroId: certificado.id,
        acao: AuditAcao.CRIAR,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role as any,
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        newValue: certificado,
      }).catch(e => this.logger.warn(`Auditoria falhou em emitirCertificado de Apoiador: ${e.message}`));
    }

    return {
      certificado,
      pdfBase64,
    };
  }

  async getCertificados(apoiadorId: string) {
    await this.findOne(apoiadorId);
    return this.prisma.certificadoEmitido.findMany({
      where: { apoiadorId },
      include: {
        modelo: { select: { nome: true } },
        acao: { select: { descricaoAcao: true, dataEvento: true } },
      },
      orderBy: { dataEmissao: 'desc' },
    });
  }

  async gerarPdfCertificado(apoiadorId: string, certId: string): Promise<Buffer> {
    const apoiador = await this.findOne(apoiadorId);

    const cert = await this.prisma.certificadoEmitido.findFirst({
      where: { id: certId, apoiadorId },
      include: {
        modelo: true,
        acao: true,
      },
    });

    if (!cert) throw new NotFoundException('Certificado não encontrado.');

    // Se já tiver URL salva no Cloudinary, re-gera localmente de qualquer forma
    // mas avisa que o ideal é retornar redirect. O controller vai redirect.
    if (!cert.modelo) {
      // Modelo excluído mas há URL salva
      if (cert.pdfUrl) {
        // Retorna um buffer vazio - o controller vai usar a pdfUrl diretamente
        throw new NotFoundException('__USE_PDF_URL__:' + cert.pdfUrl);
      }
      throw new NotFoundException('Modelo do certificado foi excluído e não há PDF salvo.');
    }

    const nomeDestinatario = apoiador.nomeFantasia || apoiador.nomeRazaoSocial || 'Apoiador';
    const motivo = cert.motivoPersonalizado || cert.acao?.descricaoAcao || '';
    const dataEmissaoStr = cert.dataEmissao?.toISOString() || new Date().toISOString();

    // Formata sem offset de timezone
    const partes = dataEmissaoStr.split('T')[0].split('-');
    const dataFormatada = partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : new Date(dataEmissaoStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const textoFormatado = (cert.modelo.textoTemplate || '')
      .replaceAll('{{ALUNO}}', nomeDestinatario)
      .replaceAll('{{NOME}}', nomeDestinatario)
      .replaceAll('{{APOIADOR}}', nomeDestinatario)
      .replaceAll('{{PARCEIRO}}', nomeDestinatario)
      .replaceAll('{{NOME_APOIADOR}}', nomeDestinatario)
      .replaceAll('{{MOTIVO}}', motivo)
      .replaceAll('{{DATA_EMISSAO}}', dataFormatada)
      .replaceAll('{{DATA_EVENTO}}', dataFormatada)
      .replaceAll('{{DATA}}', dataFormatada);

    return this.pdfService.construirPdfBase(
      cert.modelo,
      textoFormatado,
      cert.codigoValidacao,
      nomeDestinatario,
    );
  }
}
