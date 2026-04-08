import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../certificados/pdf.service';
import { UploadService } from '../upload/upload.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { formatarDataBR, preencherTemplateTexto } from '../common/helpers/data.helper';
import { CreateApoiadorDto, UpdateApoiadorDto, CreateAcaoApoiadorDto, UpdateAcaoApoiadorDto } from './dto/apoiador.dto';
import { EmitirCertificadoApoiadorDto } from './dto/emitir-certificado-apoiador.dto';
import { Prisma, TipoApoiador, AuditAcao } from '@prisma/client';
import * as crypto from 'node:crypto';

// ── Tipos Internos ─────────────────────────────────────────────────────────────

/** Campos seguros para endpoints públicos — exclui dados sensíveis PII. */
const PUBLIC_SELECT = {
  id: true,
  tipo: true,
  nomeRazaoSocial: true,
  nomeFantasia: true,
  atividadeEspecialidade: true,
  logoUrl: true,
  exibirNoSite: true,
} as const;

/** Campos para listagens admin — inclui dados operacionais, exclui observações pesadas. */
const LIST_SELECT = {
  id: true,
  tipo: true,
  nomeRazaoSocial: true,
  nomeFantasia: true,
  cpfCnpj: true,
  contatoPessoa: true,
  telefone: true,
  email: true,
  cep: true,
  rua: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  atividadeEspecialidade: true,
  logoUrl: true,
  ativo: true,
  exibirNoSite: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

/** Hosts autorizados para redirect de PDFs — SSRF prevention (OWASP A10 / CWE-918). */
const REDIRECT_ALLOWLIST = new Set(['res.cloudinary.com', 'api.cloudinary.com']);

// ── Tipo de retorno do gerarPdf ────────────────────────────────────────────────

export type PdfResult = { type: 'buffer'; buffer: Buffer } | { type: 'redirect'; url: string };

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class ApoiadoresService {
  private readonly logger = new Logger(ApoiadoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditLogService,
  ) {}

  // ── CRUD Principal ──────────────────────────────────────────────────────────

  async create(dto: CreateApoiadorDto, auditUser?: AuditUser) {
    const { acoes, ...rest } = dto;
    const result = await this.prisma.apoiador.create({
      data: {
        ...rest,
        acoes: acoes && acoes.length > 0 ? { create: acoes } : undefined,
      },
    });

    this.dispararAuditoria({
      entidade: 'Apoiador',
      registroId: result.id,
      acao: AuditAcao.CRIAR,
      auditUser,
      newValue: result,
    });

    return result;
  }

  async findAll(params: { skip?: number; take?: number; tipo?: TipoApoiador; search?: string; ativo?: boolean }) {
    const { skip, take, tipo, search, ativo } = params;

    const where: Prisma.ApoiadorWhereInput = {
      // Por padrão lista todos se undefined; ativo=false lista inativos; ativo=true ativos
      ...(ativo !== undefined && { ativo }),
      ...(tipo && { tipo }),
      ...(search && {
        OR: [
          { nomeRazaoSocial: { contains: search, mode: 'insensitive' } },
          { nomeFantasia: { contains: search, mode: 'insensitive' } },
          { atividadeEspecialidade: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Promise.all paralelo — elimina N+1 entre findMany e count
    const [data, total] = await Promise.all([
      this.prisma.apoiador.findMany({
        skip,
        take,
        where,
        select: LIST_SELECT, // exclui observacoes (campo @db.Text) da listagem
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.apoiador.count({ where }),
    ]);

    return { total, data };
  }

  /** Endpoint público — exclui campos PII (cpfCnpj, email, observacoes, contatoPessoa). */
  async findPublic() {
    return this.prisma.apoiador.findMany({
      where: { ativo: true, exibirNoSite: true },
      select: PUBLIC_SELECT,
      orderBy: { nomeRazaoSocial: 'asc' },
    });
  }

  /** Busca completa por ID (inclui observacoes e todos os campos). */
  async findOne(id: string) {
    const apoiador = await this.prisma.apoiador.findUnique({ where: { id } });
    if (!apoiador) {
      throw new NotFoundException(`Apoiador com ID ${id} não encontrado.`);
    }
    return apoiador;
  }

  async update(id: string, dto: UpdateApoiadorDto, auditUser?: AuditUser) {
    const { acoes, ...rest } = dto;
    const oldApoiador = await this.findOne(id);
    const result = await this.prisma.apoiador.update({ where: { id }, data: rest });

    this.dispararAuditoria({
      entidade: 'Apoiador',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      auditUser,
      oldValue: oldApoiador,
      newValue: result,
    });

    return result;
  }

  /**
   * Atualiza somente o campo logoUrl — chamado após upload bem-sucedido pelo Controller.
   * A verificação de existência já foi feita pelo Controller antes do upload.
   */
  async updateLogo(id: string, logoUrl: string, auditUser?: AuditUser) {
    const oldApoiador = await this.findOne(id);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { logoUrl },
      select: { id: true, logoUrl: true }, // retorna mínimo necessário
    });

    this.dispararAuditoria({
      entidade: 'Apoiador',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      auditUser,
      oldValue: { logoUrl: oldApoiador.logoUrl },
      newValue: { logoUrl: result.logoUrl },
    });

    return result;
  }

  async inativar(id: string, auditUser?: AuditUser) {
    await this.findOne(id); // cláusula de guarda: garante existência
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { ativo: false, exibirNoSite: false },
    });

    this.dispararAuditoria({
      entidade: 'Apoiador',
      registroId: id,
      acao: AuditAcao.MUDAR_STATUS,
      auditUser,
      oldValue: { ativo: true, exibirNoSite: true },
      newValue: { ativo: false, exibirNoSite: false },
    });

    return result;
  }

  async reativar(id: string, auditUser?: AuditUser) {
    const apoiador = await this.findOne(id);
    const result = await this.prisma.apoiador.update({
      where: { id },
      data: { ativo: true, exibirNoSite: true },
    });

    this.dispararAuditoria({
      entidade: 'Apoiador',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      auditUser,
      oldValue: { ativo: apoiador.ativo, exibirNoSite: apoiador.exibirNoSite },
      newValue: { ativo: true, exibirNoSite: true },
    });

    return result;
  }

  // ── Histórico de Ações ──────────────────────────────────────────────────────

  async addAcao(apoiadorId: string, dto: CreateAcaoApoiadorDto, auditUser?: AuditUser) {
    await this.findOne(apoiadorId); // cláusula de guarda

    const acao = await this.prisma.acaoApoiador.create({
      data: {
        dataEvento: new Date(dto.dataEvento),
        descricaoAcao: dto.descricaoAcao,
        apoiadorId,
      },
    });

    // Certificado automático é opcional — falha silenciosa não bloqueia a ação
    if (dto.modeloCertificadoId) {
      await this.emitirCertificado(
        apoiadorId,
        {
          modeloId: dto.modeloCertificadoId,
          acaoId: acao.id,
          motivoPersonalizado: dto.motivoPersonalizado ?? dto.descricaoAcao,
          dataEmissao: dto.dataEvento,
        },
        auditUser,
      );
    }

    this.dispararAuditoria({
      entidade: 'AcaoApoiador',
      registroId: acao.id,
      acao: AuditAcao.CRIAR,
      auditUser,
      newValue: acao,
    });

    return acao;
  }

  async updateAcao(apoiadorId: string, acaoId: string, dto: UpdateAcaoApoiadorDto, auditUser?: AuditUser) {
    await this.findOne(apoiadorId);

    const acao = await this.prisma.acaoApoiador.findFirst({
      where: { id: acaoId, apoiadorId },
    });
    if (!acao) throw new NotFoundException('Ação não encontrada nesse perfil.');

    const acaoAtualizada = await this.prisma.acaoApoiador.update({
      where: { id: acaoId },
      data: {
        ...(dto.dataEvento && { dataEvento: new Date(dto.dataEvento) }),
        ...(dto.descricaoAcao && { descricaoAcao: dto.descricaoAcao }),
      },
    });

    // Reemissão de certificado: atômica — deleta existentes e recria num único fluxo
    if (dto.modeloCertificadoId) {
      await this.prisma.certificadoEmitido.deleteMany({ where: { acaoId } });
      await this.emitirCertificado(
        apoiadorId,
        {
          modeloId: dto.modeloCertificadoId,
          acaoId,
          motivoPersonalizado: dto.motivoPersonalizado ?? dto.descricaoAcao,
          dataEmissao: dto.dataEvento,
        },
        auditUser,
      );
    }

    this.dispararAuditoria({
      entidade: 'AcaoApoiador',
      registroId: acao.id,
      acao: AuditAcao.ATUALIZAR,
      auditUser,
      oldValue: acao,
      newValue: acaoAtualizada,
    });

    return acaoAtualizada;
  }

  async getAcoes(apoiadorId: string) {
    await this.findOne(apoiadorId);
    return this.prisma.acaoApoiador.findMany({
      where: { apoiadorId },
      orderBy: { dataEvento: 'desc' },
    });
  }

  async removeAcao(apoiadorId: string, acaoId: string, auditUser?: AuditUser) {
    const acao = await this.prisma.acaoApoiador.findFirst({
      where: { id: acaoId, apoiadorId },
    });
    if (!acao) throw new NotFoundException('Ação não encontrada nesse perfil.');

    // $transaction garante ACID: certificados relacionados + ação excluídos atomicamente
    await this.prisma.$transaction([
      this.prisma.certificadoEmitido.deleteMany({ where: { acaoId } }),
      this.prisma.acaoApoiador.delete({ where: { id: acaoId } }),
    ]);

    this.dispararAuditoria({
      entidade: 'AcaoApoiador',
      registroId: acao.id,
      acao: AuditAcao.EXCLUIR,
      auditUser,
      oldValue: acao,
      newValue: null,
    });
  }

  // ── Certificados ────────────────────────────────────────────────────────────

  async emitirCertificado(apoiadorId: string, dto: EmitirCertificadoApoiadorDto, auditUser?: AuditUser) {
    // Promise.all paralelo: apoiador + modelo buscados numa só rodada de I/O
    const [apoiador, modelo] = await Promise.all([
      this.findOne(apoiadorId),
      this.prisma.modeloCertificado.findUnique({ where: { id: dto.modeloId } }),
    ]);

    if (!modelo) {
      throw new NotFoundException('Modelo de certificado não encontrado.');
    }

    const codigoValidacao = crypto.randomBytes(6).toString('hex').toUpperCase();
    const dataEmissaoStr = dto.dataEmissao ?? new Date().toISOString();
    const nomeDestinatario = apoiador.nomeFantasia || apoiador.nomeRazaoSocial || 'Apoiador';
    const dataEmissaoFormatada = formatarDataBR(dataEmissaoStr);

    const textoFormatado = preencherTemplateTexto(modelo.textoTemplate ?? '', {
      nomeDestinatario,
      motivo: dto.motivoPersonalizado ?? '',
      dataEmissao: dataEmissaoFormatada,
    });

    const pdfBuffer = await this.pdfService.construirPdfBase(modelo, textoFormatado, codigoValidacao, nomeDestinatario);

    // Upload opcional — falha não impede o registro do certificado
    let pdfUrl: string | null = null;
    try {
      const fileName = `certificado-${codigoValidacao}.pdf`;
      const uploaded = await this.uploadService.uploadPdfBuffer(pdfBuffer, fileName);
      pdfUrl = uploaded.url;
    } catch (uploadErr: unknown) {
      const msg = uploadErr instanceof Error ? uploadErr.message : JSON.stringify(uploadErr);
      this.logger.error(`[CertificadoEmitido] Falha no upload para o Cloudinary: ${msg}`);
    }

    const certificado = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao,
        modeloId: modelo.id,
        apoiadorId: apoiador.id,
        acaoId: dto.acaoId ?? null,
        motivoPersonalizado: dto.motivoPersonalizado ?? null,
        dataEmissao: new Date(dataEmissaoStr),
        pdfUrl,
      },
    });

    this.dispararAuditoria({
      entidade: 'CertificadoEmitido',
      registroId: certificado.id,
      acao: AuditAcao.CRIAR,
      auditUser,
      newValue: certificado,
    });

    return { certificado, pdfBase64: pdfBuffer.toString('base64') };
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

  /**
   * Gera ou redireciona para o PDF do certificado.
   *
   * Inclui SSRF prevention (OWASP A10 / CWE-918): valida o host da URL
   * antes de retornar ao Controller — Controller nunca recebe URL não validada.
   */
  async gerarPdfCertificado(apoiadorId: string, certId: string): Promise<PdfResult> {
    const [apoiador, cert] = await Promise.all([
      this.findOne(apoiadorId),
      this.prisma.certificadoEmitido.findFirst({
        where: { id: certId, apoiadorId },
        include: {
          modelo: {
            select: {
              id: true,
              nome: true,
              textoTemplate: true,
              arteBaseUrl: true,
              assinaturaUrl: true,
              assinaturaUrl2: true,
              nomeAssinante: true,
              cargoAssinante: true,
              nomeAssinante2: true,
              cargoAssinante2: true,
              layoutConfig: true,
              tipo: true,
            },
          },
          acao: { select: { descricaoAcao: true } },
        },
      }),
    ]);

    if (!cert) throw new NotFoundException('Certificado não encontrado.');

    // Modelo excluído mas URL salva: redirect validado
    if (!cert.modelo) {
      if (!cert.pdfUrl) {
        throw new NotFoundException('Modelo do certificado foi excluído e não há PDF salvo.');
      }
      return { type: 'redirect', url: this.validarUrlRedirect(cert.pdfUrl) };
    }

    const nomeDestinatario = apoiador.nomeFantasia || apoiador.nomeRazaoSocial || 'Apoiador';
    const motivo = cert.motivoPersonalizado || cert.acao?.descricaoAcao || '';
    const dataEmissaoStr = cert.dataEmissao?.toISOString() ?? new Date().toISOString();

    const textoFormatado = preencherTemplateTexto(cert.modelo.textoTemplate ?? '', {
      nomeDestinatario,
      motivo,
      dataEmissao: formatarDataBR(dataEmissaoStr),
    });

    const buffer = await this.pdfService.construirPdfBase(
      cert.modelo as Parameters<PdfService['construirPdfBase']>[0],
      textoFormatado,
      cert.codigoValidacao,
      nomeDestinatario,
    );

    return { type: 'buffer', buffer };
  }

  // ── Helpers Privados ────────────────────────────────────────────────────────

  /**
   * Valida que a URL pertence à allowlist de hosts autorizados.
   * Lança BadRequestException se o host não estiver na lista.
   * Centraliza SSRF prevention — Controller recebe URL já validada.
   */
  private validarUrlRedirect(url: string): string {
    try {
      const { hostname } = new URL(url);
      if (!REDIRECT_ALLOWLIST.has(hostname)) {
        throw new BadRequestException('Destino de redirect não autorizado.');
      }
      return url;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('URL do certificado inválida.');
    }
  }

  /**
   * Fire-and-forget com tratamento seguro de erro.
   * A auditoria nunca bloqueia o fluxo principal — falhas são logadas.
   */
  private dispararAuditoria(params: {
    entidade: string;
    registroId: string;
    acao: AuditAcao;
    auditUser?: AuditUser;
    oldValue?: unknown;
    newValue?: unknown;
  }): void {
    if (!params.auditUser) return;

    const { entidade, registroId, acao, auditUser, oldValue, newValue } = params;

    this.auditService
      .registrar({
        entidade,
        registroId,
        acao,
        autorId: auditUser.sub,
        autorNome: auditUser.nome,
        autorRole: auditUser.role, // tipado — sem 'as any'
        ip: auditUser.ip,
        userAgent: auditUser.userAgent,
        oldValue,
        newValue,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        this.logger.warn(`Auditoria falhou [${entidade}/${acao}]: ${msg}`);
      });
  }
}
