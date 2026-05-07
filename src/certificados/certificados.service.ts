import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, AuditAcao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { PdfService, ModeloPdf } from './pdf.service';
import { ImageProcessingService } from './image-processing.service';
import { randomBytes } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';

export interface HonrariaPdfResult {
  pdfBuffer: Buffer;
  codigoValidacao: string;
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

  // ── Helpers Privados ───────────────────────────────────────────────────────

  /** Converte AuditUser → campos esperados pelo AuditOptions */
  private toAuditMeta(au?: AuditUser) {
    return {
      autorId: au?.sub,
      autorNome: au?.nome,
      autorRole: au?.role as string | undefined,
      ip: au?.ip,
      userAgent: au?.userAgent,
    };
  }

  /**
   * Processa assinatura (remove fundo branco) e faz upload como PNG transparente.
   */
  private async uploadAssinatura(file: Express.Multer.File): Promise<{ url: string }> {
    const pngBuffer = await this.imageProcessing.removerFundoBrancoAssinatura(file.buffer);
    const pngFile: Express.Multer.File = {
      ...file,
      buffer: pngBuffer,
      mimetype: 'image/png',
      originalname: file.originalname.replace(/\.[^.]+$/, '.png'),
    };
    return this.uploadService.uploadImage(pngFile);
  }

  /**
   * Troca um arquivo no Cloudinary: limpa o antigo (soft fail) e faz upload do novo.
   * Se não houver novo arquivo, retorna a URL atual sem alteração.
   *
   * @param urlAtual    URL já salva no banco para este campo.
   * @param novoFile    Novo arquivo enviado pelo cliente (pode ser undefined).
   * @param ehAssinatura  Se true, processa remoção de fundo branco antes do upload.
   * @param label       Nome descritivo para logging (ex: 'arteBase').
   */
  private async trocarArquivo(
    urlAtual: string | null,
    novoFile: Express.Multer.File | undefined,
    ehAssinatura: boolean,
    label: string,
  ): Promise<string | null> {
    if (!novoFile) return urlAtual;

    if (urlAtual) {
      try {
        await this.uploadService.deleteFile(urlAtual);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro genérico';
        this.logger.warn(`Falha soft ao excluir ${label} no Cloudinary: ${msg}`);
      }
    }

    const uploaded = ehAssinatura
      ? await this.uploadAssinatura(novoFile)
      : await this.uploadService.uploadImage(novoFile);

    return uploaded.url;
  }

  /**
   * Substitui todas as tags {{TAG}} de um template pelo valor correspondente.
   * Método privado — única fonte de verdade para substituição de variáveis.
   */
  private substituirTags(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce((acc, [tag, valor]) => {
      const tagEscapada = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return acc.replace(new RegExp(`{{\\s*${tagEscapada}\\s*}}`, 'gi'), valor);
    }, template);
  }

  private preencherTemplateAcademico(
    template: string,
    alunoNome: string,
    vars: Record<string, string>,
  ): string {
    const textoComTags = this.substituirTags(template, {
      ...vars,
      ALUNO: alunoNome,
      NOME_ALUNO: alunoNome,
      NOME: alunoNome,
      NOME_COMPLETO: alunoNome,
      PARTICIPANTE: alunoNome,
      BENEFICIARIO: alunoNome,
      BENEFICIARIO_NOME: alunoNome,
    });

    if (textoComTags !== template) return textoComTags;

    return textoComTags.replace(/\bo\(a\)\s+participante\b/i, `o(a) ${alunoNome}`);
  }

  private dataPtBr(data: Date = new Date()): string {
    return data.toLocaleDateString('pt-BR');
  }

  /**
   * Verifica se o aluno possui frequência mínima (≥ 75%) na turma.
   * Lança BadRequestException se a frequência for insuficiente.
   * Não bloqueia se não houver registros de frequência (dado que a turma está concluída).
   */
  private async verificarFrequencia(turmaId: string, alunoId: string): Promise<void> {
    const totalAulas = await this.prisma.frequencia.count({
      where: { turmaId, alunoId },
    });
    if (totalAulas === 0) return; // sem dados de frequência — não bloqueia emissão

    const presencas = await this.prisma.frequencia.count({
      where: {
        turmaId,
        alunoId,
        OR: [{ presente: true }, { status: { in: ['PRESENTE', 'FALTA_JUSTIFICADA'] } }],
      },
    });

    const taxaPresenca = Math.round((presencas / totalAulas) * 100);
    if (taxaPresenca < 75) {
      throw new BadRequestException(
        `O aluno possui apenas ${taxaPresenca}% de frequência. É necessário pelo menos 75% para emitir o certificado.`,
      );
    }
  }

  /**
   * Tenta fazer o parse de um JSON string silenciosamente.
   * Retorna o objeto parsado ou `Prisma.JsonNull` (para apagar) ou `undefined` (sem alterar).
   * Prisma exige NullableJsonNullValueInput | InputJsonValue para campos Json nullable.
   */
  private parseLayoutConfig(
    raw: string | undefined | null,
    contexto: string,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (raw === '') return Prisma.JsonNull; // string vazia = apagar o campo (Prisma.JsonNull)
    if (!raw) return undefined; // undefined = não alterar o campo
    try {
      return JSON.parse(raw) as Prisma.InputJsonValue;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro genérico';
      this.logger.warn(`Erro no parsing do layoutConfig (${contexto}): ${msg}`);
      return undefined;
    }
  }

  // ── CRUD de Modelos ────────────────────────────────────────────────────────

  async create(
    createDto: CreateCertificadoDto,
    arteBaseFile?: Express.Multer.File,
    assinaturaFile?: Express.Multer.File,
    assinatura2File?: Express.Multer.File,
    auditUser?: AuditUser,
  ) {
    // Upload paralelo dos 3 arquivos — sem dependência entre eles
    const [arteBaseUrlRaw, assinaturaUrlRaw, assinaturaUrl2] = await Promise.all([
      arteBaseFile ? this.uploadService.uploadImage(arteBaseFile).then((r) => r.url) : Promise.resolve(''),
      assinaturaFile ? this.uploadAssinatura(assinaturaFile).then((r) => r.url) : Promise.resolve(''),
      assinatura2File
        ? this.uploadAssinatura(assinatura2File).then((r) => r.url as string | null)
        : Promise.resolve(null),
    ]);

    const novoModelo = await this.prisma.modeloCertificado.create({
      data: {
        ...createDto,
        layoutConfig: this.parseLayoutConfig(createDto.layoutConfig, 'Create'),
        arteBaseUrl: arteBaseUrlRaw,
        assinaturaUrl: assinaturaUrlRaw,
        assinaturaUrl2,
      },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
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
    const modelo = await this.prisma.modeloCertificado.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException('Modelo de certificado não encontrado.');
    return modelo;
  }

  async update(
    id: string,
    updateDto: UpdateCertificadoDto,
    arteBaseFile?: Express.Multer.File,
    assinaturaFile?: Express.Multer.File,
    assinatura2File?: Express.Multer.File,
    auditUser?: AuditUser,
  ) {
    const modelo = await this.findOne(id);

    // Troca paralela dos 3 arquivos — delete antigo + upload novo (se enviado)
    const [arteBaseUrl, assinaturaUrl, assinaturaUrl2] = await Promise.all([
      this.trocarArquivo(modelo.arteBaseUrl, arteBaseFile, false, 'arteBase'),
      this.trocarArquivo(modelo.assinaturaUrl, assinaturaFile, true, 'assinatura'),
      this.trocarArquivo(modelo.assinaturaUrl2, assinatura2File, true, 'assinatura2'),
    ]);

    const parsedLayout = this.parseLayoutConfig(updateDto.layoutConfig, 'Update');

    const modeloAtualizado = await this.prisma.modeloCertificado.update({
      where: { id },
      data: {
        ...updateDto,
        layoutConfig: parsedLayout ?? undefined,
        arteBaseUrl: arteBaseUrl ?? modelo.arteBaseUrl,
        assinaturaUrl: assinaturaUrl ?? modelo.assinaturaUrl,
        assinaturaUrl2,
      },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'ModeloCertificado',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      oldValue: modelo,
      newValue: modeloAtualizado,
    });

    return modeloAtualizado;
  }

  async remove(id: string, auditUser?: AuditUser) {
    const modelo = await this.findOne(id);

    // Remove os arquivos externos sem bloquear a exclusao do modelo se o Cloudinary falhar.
    await Promise.allSettled([
      modelo.arteBaseUrl ? this.uploadService.deleteFile(modelo.arteBaseUrl) : Promise.resolve(),
      modelo.assinaturaUrl ? this.uploadService.deleteFile(modelo.assinaturaUrl) : Promise.resolve(),
      modelo.assinaturaUrl2 ? this.uploadService.deleteFile(modelo.assinaturaUrl2) : Promise.resolve(),
    ]).then((results) => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          this.logger.warn(`Soft fail no delete arquivo ${i} do Cloudinary: ${String(r.reason)}`);
        }
      });
    });

    const excluido = await this.prisma.modeloCertificado.delete({ where: { id } });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'ModeloCertificado',
      registroId: id,
      acao: AuditAcao.EXCLUIR,
      oldValue: modelo,
      newValue: null,
    });

    return excluido;
  }

  // ── Emissão de Certificados ────────────────────────────────────────────────

  async emitirAcademico(dto: EmitirAcademicoDto, auditUser?: AuditUser): Promise<{ pdfUrl: string; codigoValidacao: string }> {
    const turma = await this.prisma.turma.findUnique({
      where: { id: dto.turmaId },
      include: {
        modeloCertificado: true,
        matriculasOficina: { where: { alunoId: dto.alunoId } },
      },
    });

    if (!turma) throw new NotFoundException('Turma não encontrada.');

    if (turma.matriculasOficina.length === 0)
      throw new BadRequestException('O Aluno não cursa ou não está matriculado nesta turma.');

    const matricula = turma.matriculasOficina[0];
    if (turma.status !== 'CONCLUIDA' && matricula.status !== 'CONCLUIDA') {
      throw new BadRequestException('A turma ou a matrícula precisa estar CONCLUIDA para emitir certificados.');
    }

    if (!turma.modeloCertificadoId || !turma.modeloCertificado)
      throw new BadRequestException('A Turma não possui um Modelo de Certificado configurado.');

    await this.verificarFrequencia(dto.turmaId, dto.alunoId);

    // Reutiliza o codigo de validacao se ja existir, mas gera um PDF novo.
    const certExistente = await this.prisma.certificadoEmitido.findFirst({
      where: { alunoId: dto.alunoId, turmaId: dto.turmaId },
      select: { id: true, pdfUrl: true, codigoValidacao: true, dataEmissao: true },
    });
    if (certExistente?.pdfUrl) {
      // Certificado existente: regenera e sobrescreve o PDF mantendo o codigo.
      this.logger.log(`[CertificadoEmitido] Regenerando PDF existente para aluno=${dto.alunoId} turma=${dto.turmaId}`);
    }

    // Select cirúrgico — sem CPF, RG, laudos ou outros dados sensíveis desnecessários
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: dto.alunoId },
      select: { id: true, nomeCompleto: true },
    });
    if (!aluno) throw new NotFoundException('Aluno inativo ou não encontrado.');

    const cargaHr = turma.cargaHoraria ?? 'Não informada';
    const dataInic = turma.dataInicio ? turma.dataInicio.toLocaleDateString('pt-BR') : 'Data Indefinida';
    const dataFim = turma.dataFim ? turma.dataFim.toLocaleDateString('pt-BR') : 'Data Indefinida';

    const hashUnique = certExistente?.codigoValidacao ?? randomBytes(4).toString('hex').toUpperCase();
    const dataEmissao = this.dataPtBr(certExistente?.dataEmissao ?? new Date());

    const textoPronto = this.preencherTemplateAcademico(turma.modeloCertificado.textoTemplate, aluno.nomeCompleto, {
      TURMA: turma.nome,
      CURSO: turma.nome,
      NOME_CURSO: turma.nome,
      OFICINA: turma.nome,
      CARGA_HORARIA: cargaHr,
      CH: cargaHr,
      DATA_INICIO: dataInic,
      DATA_FIM: dataFim,
      DATA_EMISSAO: dataEmissao,
      CODIGO_CERTIFICADO: hashUnique,
      CODIGO_VALIDACAO: hashUnique,
      NOME_INSTITUICAO: 'Instituto Luiz Braille',
      NOME_RESPONSAVEL: turma.modeloCertificado.nomeAssinante,
      CARGO_RESPONSAVEL: turma.modeloCertificado.cargoAssinante,
    });

    // Usa codigoValidacao existente (se já havia registro sem URL) ou gera novo
    const pdfBuffer = await this.pdfService.construirPdfBase(
      turma.modeloCertificado as ModeloPdf,
      textoPronto,
      hashUnique,
      aluno.nomeCompleto,
    );

    // Public ID determinístico — overwrite automático, sem arquivos órfãos
    const publicId = `cert-acad-${dto.alunoId}-${dto.turmaId}`;
    let pdfUrl: string;
    try {
      const uploaded = await this.uploadService.uploadPdfBuffer(pdfBuffer, publicId);
      pdfUrl = uploaded.url;
    } catch (uploadErr: unknown) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      this.logger.error(`[CertificadoEmitido] Falha no upload Cloudinary: ${msg}`);
      throw new BadRequestException('Falha ao armazenar o certificado. Tente novamente.');
    }

    let codigoFinal: string;
    if (certExistente) {
      // Registro existia mas sem URL — apenas atualiza pdfUrl
      await this.prisma.certificadoEmitido.update({
        where: { id: certExistente.id },
        data: { pdfUrl },
      });
      codigoFinal = certExistente.codigoValidacao;
    } else {
      // Cria o registro pela primeira vez
      const certificadoEmitido = await this.prisma.certificadoEmitido.create({
        data: { codigoValidacao: hashUnique, alunoId: aluno.id, turmaId: turma.id, modeloId: turma.modeloCertificado.id, pdfUrl },
      });
      codigoFinal = certificadoEmitido.codigoValidacao;

      this.auditService.registrar({
        ...this.toAuditMeta(auditUser),
        entidade: 'CertificadoEmitido',
        registroId: certificadoEmitido.id,
        acao: AuditAcao.CRIAR,
        newValue: certificadoEmitido,
      });
    }

    return { pdfUrl, codigoValidacao: codigoFinal };
  }

  async emitirHonraria(dto: EmitirHonrariaDto, auditUser?: AuditUser): Promise<HonrariaPdfResult> {
    const modelo = await this.prisma.modeloCertificado.findUnique({ where: { id: dto.modeloId } });

    if (!modelo) throw new NotFoundException('Modelo de certificado não encontrado.');
    if (modelo.tipo !== 'HONRARIA') throw new BadRequestException('O Modelo informado não é do tipo HONRARIA.');

    const hashUnique = randomBytes(4).toString('hex').toUpperCase();
    const textoPronto = this.substituirTags(modelo.textoTemplate, {
      PARCEIRO: dto.nomeParceiro,
      NOME_ALUNO: dto.nomeParceiro,
      NOME: dto.nomeParceiro,
      NOME_RESPONSAVEL: modelo.nomeAssinante,
      CARGO_RESPONSAVEL: modelo.cargoAssinante,
      MOTIVO: dto.motivo,
      DATA: dto.dataEmissao,
      DATA_EMISSAO: dto.dataEmissao,
      CODIGO_CERTIFICADO: hashUnique,
      CODIGO_VALIDACAO: hashUnique,
      NOME_INSTITUICAO: 'Instituto Luiz Braille',
    });

    const emissao = await this.prisma.certificadoEmitido.create({
      data: { codigoValidacao: hashUnique, modeloId: modelo.id },
    });

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'CertificadoEmitido',
      registroId: emissao.id,
      acao: AuditAcao.CRIAR,
      newValue: emissao,
    });

    const pdfBuffer = await this.pdfService.construirPdfBase(modelo as ModeloPdf, textoPronto, hashUnique);
    return { pdfBuffer, codigoValidacao: hashUnique };
  }

  /**
   * Regenera (somente os que já têm URL salva) os certificados acadêmicos de um aluno.
   * Chamado em background quando nomeCompleto é alterado — nunca bloqueia o PATCH do aluno.
   * Public ID determinístico garante overwrite no Cloudinary sem arquivos órfãos.
   */
  async regenerarCertificadosAluno(alunoId: string): Promise<void> {
    const [aluno, certs] = await Promise.all([
      this.prisma.aluno.findUnique({ where: { id: alunoId }, select: { id: true, nomeCompleto: true } }),
      this.prisma.certificadoEmitido.findMany({
        where: { alunoId, pdfUrl: { not: null } },
        include: { turma: { include: { modeloCertificado: true } } },
      }),
    ]);

    if (!aluno || certs.length === 0) return;

    for (const cert of certs) {
      const turma = cert.turma;
      if (!turma || !turma.modeloCertificado) continue;
      
      const modeloCert = turma.modeloCertificado;
      try {
        const textoPronto = this.preencherTemplateAcademico(modeloCert.textoTemplate, aluno.nomeCompleto, {
          TURMA: turma.nome,
          CURSO: turma.nome,
          NOME_CURSO: turma.nome,
          OFICINA: turma.nome,
          CH: turma.cargaHoraria ?? 'Não informada',
          CARGA_HORARIA: turma.cargaHoraria ?? 'Não informada',
          DATA_INICIO: turma.dataInicio ? turma.dataInicio.toLocaleDateString('pt-BR') : 'Data Indefinida',
          DATA_FIM: turma.dataFim ? turma.dataFim.toLocaleDateString('pt-BR') : 'Data Indefinida',
          DATA_EMISSAO: this.dataPtBr(cert.dataEmissao),
          CODIGO_CERTIFICADO: cert.codigoValidacao,
          CODIGO_VALIDACAO: cert.codigoValidacao,
          NOME_INSTITUICAO: 'Instituto Luiz Braille',
          NOME_RESPONSAVEL: modeloCert.nomeAssinante,
          CARGO_RESPONSAVEL: modeloCert.cargoAssinante,
        });

        const pdfBuffer = await this.pdfService.construirPdfBase(
          modeloCert as ModeloPdf,
          textoPronto,
          cert.codigoValidacao,
          aluno.nomeCompleto,
        );

        const { url } = await this.uploadService.uploadPdfBuffer(
          pdfBuffer,
          `cert-acad-${alunoId}-${cert.turmaId}`,  // overwrite determinístico
        );

        await this.prisma.certificadoEmitido.update({ where: { id: cert.id }, data: { pdfUrl: url } });
        this.logger.log(`[regenerar] Cert ${cert.id} atualizado para aluno ${alunoId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[regenerar] Falha no cert ${cert.id}: ${msg}`);
      }
    }
  }

  async validarPublico(codigo: string) {
    // Guarda de formato — previne queries desnecessárias com strings arbitrárias
    if (codigo.length > 20 || !/^[A-Z0-9-]+$/.test(codigo)) {
      throw new NotFoundException('Certificado não encontrado ou código de validação inválido.');
    }

    const emissao = await this.prisma.certificadoEmitido.findUnique({
      where: { codigoValidacao: codigo },
      include: {
        aluno: { select: { nomeCompleto: true } },
        turma: { select: { nome: true, cargaHoraria: true } },
        modelo: { select: { nome: true, tipo: true } },
      },
    });

    if (!emissao) throw new NotFoundException('Certificado não encontrado ou código de validação inválido.');

    const isAcademico = emissao.modelo.tipo === 'ACADEMICO' && emissao.aluno && emissao.turma;

    return {
      valido: true,
      nome: isAcademico ? (emissao.aluno?.nomeCompleto ?? 'Desconhecido') : 'Parceiro Institucional / Apoiador',
      curso: isAcademico ? (emissao.turma?.nome ?? emissao.modelo.nome) : emissao.modelo.nome,
      data: emissao.dataEmissao.toLocaleDateString('pt-BR'),
      dataEmissao: emissao.dataEmissao.toLocaleDateString('pt-BR'),
      cargaHoraria: isAcademico ? (emissao.turma?.cargaHoraria ?? 'Não informada') : 'Não se aplica',
      codigoValidacao: emissao.codigoValidacao,
      status: 'VALIDO',
      tipo: emissao.modelo.tipo,
    };
  }
}
