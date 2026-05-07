import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, AuditAcao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { EmitirAcademicoDto } from './dto/emitir-academico.dto';
import { EmitirHonrariaDto } from './dto/emitir-honraria.dto';
import { CancelarCertificadoDto } from './dto/cancelar-certificado.dto';
import { EmitirManualAcademicoDto } from './dto/emitir-manual-academico.dto';
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

  private validarNumeroPercentual(valor: unknown, campo: string): void {
    if (valor === undefined || valor === null) return;
    if (typeof valor !== 'number' || Number.isNaN(valor) || valor < 0 || valor > 100) {
      throw new BadRequestException(`${campo} deve ser um numero entre 0 e 100.`);
    }
  }

  private validarNumeroPositivo(valor: unknown, campo: string, max = 300): void {
    if (valor === undefined || valor === null) return;
    if (typeof valor !== 'number' || Number.isNaN(valor) || valor <= 0 || valor > max) {
      throw new BadRequestException(`${campo} deve ser um numero positivo ate ${max}.`);
    }
  }

  private validarLayoutElements(elements: unknown, contexto: string): void {
    if (elements === undefined || elements === null) return;
    if (!Array.isArray(elements)) {
      throw new BadRequestException(`layoutConfig.elements (${contexto}) deve ser uma lista.`);
    }
    if (elements.length > 100) {
      throw new BadRequestException('layoutConfig.elements deve ter no maximo 100 elementos.');
    }

    const tiposPermitidos = new Set([
      'TEXT',
      'DYNAMIC_TEXT',
      'SIGNATURE_IMAGE',
      'SIGNATURE_BLOCK',
      'QR_CODE',
      'VALIDATION_CODE',
      'LINE',
    ]);

    elements.forEach((elemento, index) => {
      const prefixo = `layoutConfig.elements[${index}]`;
      if (!elemento || typeof elemento !== 'object' || Array.isArray(elemento)) {
        throw new BadRequestException(`${prefixo} deve ser um objeto.`);
      }

      const item = elemento as Record<string, unknown>;
      if (typeof item.id !== 'string' || !item.id.trim()) {
        throw new BadRequestException(`${prefixo}.id deve ser uma string obrigatoria.`);
      }
      if (typeof item.type !== 'string' || !tiposPermitidos.has(item.type)) {
        throw new BadRequestException(`${prefixo}.type deve ser um tipo de elemento valido.`);
      }
      if (typeof item.label !== 'string' || !item.label.trim()) {
        throw new BadRequestException(`${prefixo}.label deve ser uma string obrigatoria.`);
      }
      if (item.content !== undefined && item.content !== null && typeof item.content !== 'string') {
        throw new BadRequestException(`${prefixo}.content deve ser uma string.`);
      }
      if (item.visible !== undefined && item.visible !== null && typeof item.visible !== 'boolean') {
        throw new BadRequestException(`${prefixo}.visible deve ser booleano.`);
      }

      this.validarNumeroPercentual(item.x, `${prefixo}.x`);
      this.validarNumeroPercentual(item.y, `${prefixo}.y`);
      this.validarNumeroPercentual(item.width, `${prefixo}.width`);
      this.validarNumeroPercentual(item.height, `${prefixo}.height`);
      this.validarNumeroPositivo(item.fontSize, `${prefixo}.fontSize`);
      this.validarNumeroPositivo(item.lineHeight, `${prefixo}.lineHeight`, 10);
      this.validarNumeroPositivo(item.zIndex, `${prefixo}.zIndex`, 1000);
    });
  }

  private validarLayoutConfig(layout: unknown, contexto: string): Prisma.InputJsonValue {
    if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
      throw new BadRequestException(`layoutConfig (${contexto}) deve ser um objeto JSON valido.`);
    }

    const config = layout as Record<string, unknown>;
    const campos = ['textoPronto', 'nomeAluno', 'assinatura1', 'assinatura2', 'qrCode'];

    campos.forEach((campo) => {
      const elemento = config[campo];
      if (elemento === undefined || elemento === null) return;
      if (typeof elemento !== 'object' || Array.isArray(elemento)) {
        throw new BadRequestException(`layoutConfig.${campo} deve ser um objeto.`);
      }

      const item = elemento as Record<string, unknown>;
      this.validarNumeroPercentual(item.x, `layoutConfig.${campo}.x`);
      this.validarNumeroPercentual(item.y, `layoutConfig.${campo}.y`);
      this.validarNumeroPercentual(item.width, `layoutConfig.${campo}.width`);
      this.validarNumeroPercentual(item.maxWidth, `layoutConfig.${campo}.maxWidth`);
      this.validarNumeroPercentual(item.size, `layoutConfig.${campo}.size`);
      this.validarNumeroPositivo(item.fontSize, `layoutConfig.${campo}.fontSize`);
    });

    this.validarLayoutElements(config.elements, contexto);

    return layout as Prisma.InputJsonValue;
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
      return this.validarLayoutConfig(JSON.parse(raw), contexto);
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : 'Erro genérico';
      this.logger.warn(`Erro no parsing do layoutConfig (${contexto}): ${msg}`);
      throw new BadRequestException('layoutConfig deve ser um JSON valido.');
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
    const parsedLayout = this.parseLayoutConfig(createDto.layoutConfig, 'Create');

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
        layoutConfig: parsedLayout,
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
    const parsedLayout = this.parseLayoutConfig(updateDto.layoutConfig, 'Update');

    // Troca paralela dos 3 arquivos — delete antigo + upload novo (se enviado)
    const [arteBaseUrl, assinaturaUrl, assinaturaUrl2] = await Promise.all([
      this.trocarArquivo(modelo.arteBaseUrl, arteBaseFile, false, 'arteBase'),
      this.trocarArquivo(modelo.assinaturaUrl, assinaturaFile, true, 'assinatura'),
      this.trocarArquivo(modelo.assinaturaUrl2, assinatura2File, true, 'assinatura2'),
    ]);

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

    // CACHE CHECK: certificado já emitido com PDF salvo?
    const certExistente = await this.prisma.certificadoEmitido.findFirst({
      where: { alunoId: dto.alunoId, turmaId: dto.turmaId, status: 'VALID' },
      select: { id: true, pdfUrl: true, codigoValidacao: true, dataEmissao: true },
      orderBy: { dataEmissao: 'desc' },
    } as never);
    if (certExistente?.pdfUrl) {
      // CACHE HIT — sem gerar PDF, sem I/O pesado
      this.logger.log(`[CertificadoEmitido] CACHE HIT para aluno=${dto.alunoId} turma=${dto.turmaId}`);
      return { pdfUrl: certExistente.pdfUrl, codigoValidacao: certExistente.codigoValidacao };
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

    const templateVars = {
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
    };
    const textoPronto = this.preencherTemplateAcademico(turma.modeloCertificado.textoTemplate, aluno.nomeCompleto, templateVars);

    // Usa codigoValidacao existente (se já havia registro sem URL) ou gera novo
    const pdfBuffer = await this.pdfService.construirPdfBase(
      turma.modeloCertificado as ModeloPdf,
      textoPronto,
      hashUnique,
      aluno.nomeCompleto,
      templateVars,
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
        data: {
          codigoValidacao: hashUnique,
          alunoId: aluno.id,
          turmaId: turma.id,
          modeloId: turma.modeloCertificado.id,
          pdfUrl,
          status: 'VALID',
          nomeImpresso: aluno.nomeCompleto,
          cursoImpresso: turma.nome,
          cargaHorariaImpresso: cargaHr,
        },
      } as never);
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

  async emitirManualAcademico(
    dto: EmitirManualAcademicoDto,
    auditUser?: AuditUser,
  ): Promise<{ pdfUrl: string; codigoValidacao: string; certificadoId: string }> {
    const [modelo, aluno, turma] = await Promise.all([
      this.prisma.modeloCertificado.findUnique({ where: { id: dto.modeloId } }),
      this.prisma.aluno.findFirst({
        where: { id: dto.alunoId, statusAtivo: true, excluido: false },
        select: { id: true, nomeCompleto: true, matricula: true },
      }),
      this.prisma.turma.findFirst({
        where: { id: dto.turmaId, excluido: false },
        select: { id: true, nome: true, cargaHoraria: true, dataInicio: true, dataFim: true },
      }),
    ]);

    if (!modelo) throw new NotFoundException('Modelo de certificado nao encontrado.');
    if (modelo.tipo !== 'ACADEMICO') throw new BadRequestException('O modelo informado deve ser ACADEMICO.');
    if (!aluno) throw new NotFoundException('Aluno cadastrado nao encontrado ou inativo.');
    if (!turma) throw new NotFoundException('Curso/turma cadastrada nao encontrada.');

    await this.garantirHistoricoCursoManual(aluno.id, turma.id, auditUser);

    const hashUnique = randomBytes(4).toString('hex').toUpperCase();
    const issueDate = dto.dataEmissao ? new Date(dto.dataEmissao) : new Date();
    const nomeAluno = aluno.nomeCompleto;
    const matricula = aluno.matricula ?? dto.matricula ?? '';
    const nomeCurso = turma.nome;
    const cargaHoraria = turma.cargaHoraria ?? dto.cargaHoraria ?? 'Nao informada';
    const dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : turma.dataInicio;
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : turma.dataFim;
    const templateVars = {
      ALUNO: nomeAluno,
      NOME_ALUNO: nomeAluno,
      NOME: nomeAluno,
      NOME_COMPLETO: nomeAluno,
      MATRICULA: matricula,
      TURMA: nomeCurso,
      CURSO: nomeCurso,
      NOME_CURSO: nomeCurso,
      OFICINA: nomeCurso,
      CARGA_HORARIA: cargaHoraria,
      CH: cargaHoraria,
      DATA_INICIO: dataInicio ? this.dataPtBr(dataInicio) : '',
      DATA_FIM: dataFim ? this.dataPtBr(dataFim) : '',
      DATA_EMISSAO: this.dataPtBr(issueDate),
      CODIGO_CERTIFICADO: hashUnique,
      CODIGO_VALIDACAO: hashUnique,
      NOME_INSTITUICAO: 'Instituto Luiz Braille',
      NOME_RESPONSAVEL: modelo.nomeAssinante,
      CARGO_RESPONSAVEL: modelo.cargoAssinante,
    };
    const textoPronto = this.preencherTemplateAcademico(modelo.textoTemplate, nomeAluno, templateVars);
    const pdfBuffer = await this.pdfService.construirPdfBase(
      modelo as ModeloPdf,
      textoPronto,
      hashUnique,
      nomeAluno,
      templateVars,
    );
    const uploaded = await this.uploadService.uploadPdfBuffer(pdfBuffer, `cert-manual-acad-${hashUnique}`);

    const certificado = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        dataEmissao: issueDate,
        modeloId: modelo.id,
        alunoId: aluno.id,
        turmaId: turma.id,
        pdfUrl: uploaded.url,
        status: 'VALID',
        matriculaImpresso: matricula,
        nomeImpresso: nomeAluno,
        cursoImpresso: nomeCurso,
        cargaHorariaImpresso: cargaHoraria,
        dadosManuais: {
          origem: 'CERTIFICADO_MANUAL_ACADEMICO',
          dataInicio: dataInicio?.toISOString() ?? null,
          dataFim: dataFim?.toISOString() ?? null,
          dataEmissao: dto.dataEmissao ?? null,
        },
      },
    } as never);

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'CertificadoEmitido',
      registroId: certificado.id,
      acao: AuditAcao.CRIAR,
      newValue: certificado,
    });

    return { pdfUrl: uploaded.url, codigoValidacao: hashUnique, certificadoId: certificado.id };
  }

  private async garantirHistoricoCursoManual(alunoId: string, turmaId: string, auditUser?: AuditUser): Promise<void> {
    const matriculaExistente = await this.prisma.matriculaOficina.findFirst({
      where: {
        alunoId,
        turmaId,
        status: { in: ['ATIVA', 'CONCLUIDA'] },
      },
      orderBy: { criadoEm: 'desc' },
    } as never);

    if (matriculaExistente) {
      if ((matriculaExistente as { status?: string }).status === 'ATIVA') {
        await this.prisma.matriculaOficina.update({
          where: { id: matriculaExistente.id },
          data: {
            status: 'CONCLUIDA',
            dataEncerramento: new Date(),
            observacao: 'Concluida automaticamente por emissao manual de certificado academico.',
          },
        } as never);
      }
      return;
    }

    const matricula = await this.prisma.matriculaOficina.create({
      data: {
        alunoId,
        turmaId,
        status: 'CONCLUIDA',
        dataEntrada: new Date(),
        dataEncerramento: new Date(),
        observacao: 'Historico criado automaticamente por emissao manual de certificado academico.',
      },
    } as never);

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'MatriculaOficina',
      registroId: matricula.id,
      acao: AuditAcao.CRIAR,
      newValue: matricula,
    });
  }

  async cancelarCertificado(id: string, dto: CancelarCertificadoDto, auditUser?: AuditUser) {
    const certificado = await this.prisma.certificadoEmitido.findUnique({ where: { id } });
    if (!certificado) throw new NotFoundException('Certificado nao encontrado.');
    if ((certificado as { status?: string }).status !== 'VALID') {
      throw new BadRequestException('Somente certificados validos podem ser cancelados.');
    }

    const atualizado = await this.prisma.certificadoEmitido.update({
      where: { id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        canceledBy: auditUser?.sub,
        cancelReason: dto.motivo,
      },
    } as never);

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'CertificadoEmitido',
      registroId: id,
      acao: AuditAcao.ATUALIZAR,
      oldValue: certificado,
      newValue: atualizado,
    });

    return atualizado;
  }

  async reemitirCertificado(id: string, auditUser?: AuditUser): Promise<{ pdfUrl: string; codigoValidacao: string; certificadoId: string }> {
    const certificado = await this.prisma.certificadoEmitido.findUnique({
      where: { id },
      include: {
        aluno: { select: { id: true, nomeCompleto: true } },
        turma: { include: { modeloCertificado: true } },
        modelo: true,
      },
    });

    if (!certificado) throw new NotFoundException('Certificado nao encontrado.');
    if ((certificado as { status?: string }).status !== 'VALID') {
      throw new BadRequestException('Somente certificados validos podem ser reemitidos.');
    }
    if (!certificado.aluno || !certificado.turma || !certificado.turma.modeloCertificado) {
      throw new BadRequestException('Reemissao automatica disponivel apenas para certificados academicos vinculados a aluno e turma.');
    }

    const modeloCert = certificado.turma.modeloCertificado;
    const hashUnique = randomBytes(4).toString('hex').toUpperCase();
    const dataEmissao = this.dataPtBr(new Date());
    const templateVars = {
      TURMA: certificado.turma.nome,
      CURSO: certificado.turma.nome,
      NOME_CURSO: certificado.turma.nome,
      OFICINA: certificado.turma.nome,
      CARGA_HORARIA: certificado.turma.cargaHoraria ?? 'Nao informada',
      CH: certificado.turma.cargaHoraria ?? 'Nao informada',
      DATA_INICIO: certificado.turma.dataInicio ? certificado.turma.dataInicio.toLocaleDateString('pt-BR') : 'Data Indefinida',
      DATA_FIM: certificado.turma.dataFim ? certificado.turma.dataFim.toLocaleDateString('pt-BR') : 'Data Indefinida',
      DATA_EMISSAO: dataEmissao,
      CODIGO_CERTIFICADO: hashUnique,
      CODIGO_VALIDACAO: hashUnique,
      NOME_INSTITUICAO: 'Instituto Luiz Braille',
      NOME_RESPONSAVEL: modeloCert.nomeAssinante,
      CARGO_RESPONSAVEL: modeloCert.cargoAssinante,
    };
    const textoPronto = this.preencherTemplateAcademico(modeloCert.textoTemplate, certificado.aluno.nomeCompleto, templateVars);
    const novaVersao = ((certificado as { version?: number }).version ?? 1) + 1;

    const pdfBuffer = await this.pdfService.construirPdfBase(
      modeloCert as ModeloPdf,
      textoPronto,
      hashUnique,
      certificado.aluno.nomeCompleto,
      templateVars,
    );

    const uploaded = await this.uploadService.uploadPdfBuffer(
      pdfBuffer,
      `cert-acad-${certificado.aluno.id}-${certificado.turma.id}-v${novaVersao}`,
    );

    const [, novoCertificado] = await this.prisma.$transaction([
      this.prisma.certificadoEmitido.update({
        where: { id },
        data: { status: 'REISSUED' },
      } as never),
      this.prisma.certificadoEmitido.create({
        data: {
          codigoValidacao: hashUnique,
          alunoId: certificado.aluno.id,
          turmaId: certificado.turma.id,
          modeloId: modeloCert.id,
          pdfUrl: uploaded.url,
          status: 'VALID',
          version: novaVersao,
          previousCertificadoId: id,
          nomeImpresso: certificado.aluno.nomeCompleto,
          cursoImpresso: certificado.turma.nome,
          cargaHorariaImpresso: certificado.turma.cargaHoraria ?? 'Nao informada',
        },
      } as never),
    ]);

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'CertificadoEmitido',
      registroId: novoCertificado.id,
      acao: AuditAcao.CRIAR,
      oldValue: certificado,
      newValue: novoCertificado,
    });

    return { pdfUrl: uploaded.url, codigoValidacao: hashUnique, certificadoId: novoCertificado.id };
  }

  async emitirHonraria(dto: EmitirHonrariaDto, auditUser?: AuditUser): Promise<HonrariaPdfResult> {
    const [modelo, apoiador] = await Promise.all([
      this.prisma.modeloCertificado.findUnique({ where: { id: dto.modeloId } }),
      this.prisma.apoiador.findFirst({
        where: { id: dto.apoiadorId, ativo: true },
        select: { id: true, nomeRazaoSocial: true, nomeFantasia: true },
      }),
    ]);

    if (!modelo) throw new NotFoundException('Modelo de certificado não encontrado.');
    if (modelo.tipo !== 'HONRARIA') throw new BadRequestException('O Modelo informado não é do tipo HONRARIA.');

    if (!apoiador) throw new NotFoundException('Apoiador cadastrado nao encontrado ou inativo.');

    const hashUnique = randomBytes(4).toString('hex').toUpperCase();
    const nomeParceiro = apoiador.nomeFantasia || apoiador.nomeRazaoSocial;
    const motivo = dto.motivo || dto.tituloAcao;
    const dataEvento = dto.dataEvento ?? dto.dataEmissao;
    if (!dataEvento) throw new BadRequestException('Informe a data do evento da honraria.');

    const acao = await this.prisma.acaoApoiador.create({
      data: {
        apoiadorId: apoiador.id,
        descricaoAcao: dto.tituloAcao,
        dataEvento: new Date(dataEvento),
      },
    });
    const templateVars = {
      PARCEIRO: nomeParceiro,
      NOME_ALUNO: nomeParceiro,
      NOME: nomeParceiro,
      NOME_RESPONSAVEL: modelo.nomeAssinante,
      CARGO_RESPONSAVEL: modelo.cargoAssinante,
      TITULO_ACAO: dto.tituloAcao,
      MOTIVO: motivo,
      DATA: dataEvento,
      DATA_EVENTO: dataEvento,
      DATA_EMISSAO: this.dataPtBr(new Date()),
      CODIGO_CERTIFICADO: hashUnique,
      CODIGO_VALIDACAO: hashUnique,
      NOME_INSTITUICAO: 'Instituto Luiz Braille',
    };
    const textoPronto = this.substituirTags(modelo.textoTemplate, templateVars);

    const emissao = await this.prisma.certificadoEmitido.create({
      data: {
        codigoValidacao: hashUnique,
        modeloId: modelo.id,
        apoiadorId: apoiador.id,
        acaoId: acao.id,
        status: 'VALID',
        nomeImpresso: nomeParceiro,
        cursoImpresso: dto.tituloAcao,
        cargaHorariaImpresso: 'Nao se aplica',
        motivoPersonalizado: motivo,
        dadosManuais: {
          origem: 'CERTIFICADO_MANUAL_HONRARIA',
          tituloAcao: dto.tituloAcao,
          motivo,
          dataEvento,
        },
      },
    } as never);

    this.auditService.registrar({
      ...this.toAuditMeta(auditUser),
      entidade: 'CertificadoEmitido',
      registroId: emissao.id,
      acao: AuditAcao.CRIAR,
      newValue: emissao,
    });

    const pdfBuffer = await this.pdfService.construirPdfBase(
      modelo as ModeloPdf,
      textoPronto,
      hashUnique,
      nomeParceiro,
      templateVars,
    );
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
        const templateVars = {
          TURMA: turma.nome,
          CURSO: turma.nome,
          NOME_CURSO: turma.nome,
          OFICINA: turma.nome,
          CARGA_HORARIA: turma.cargaHoraria ?? 'Não informada',
          CH: turma.cargaHoraria ?? 'Nao informada',
          DATA_INICIO: turma.dataInicio ? turma.dataInicio.toLocaleDateString('pt-BR') : 'Data Indefinida',
          DATA_FIM: turma.dataFim ? turma.dataFim.toLocaleDateString('pt-BR') : 'Data Indefinida',
          DATA_EMISSAO: this.dataPtBr(cert.dataEmissao),
          CODIGO_CERTIFICADO: cert.codigoValidacao,
          CODIGO_VALIDACAO: cert.codigoValidacao,
          NOME_INSTITUICAO: 'Instituto Luiz Braille',
          NOME_RESPONSAVEL: modeloCert.nomeAssinante,
          CARGO_RESPONSAVEL: modeloCert.cargoAssinante,
        };
        const textoPronto = this.preencherTemplateAcademico(modeloCert.textoTemplate, aluno.nomeCompleto, templateVars);

        const pdfBuffer = await this.pdfService.construirPdfBase(
          modeloCert as ModeloPdf,
          textoPronto,
          cert.codigoValidacao,
          aluno.nomeCompleto,
          templateVars,
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
    const status = (emissao as { status?: string }).status ?? 'VALID';
    const valido = status === 'VALID';
    const snapshot = emissao as {
      nomeImpresso?: string | null;
      cursoImpresso?: string | null;
      cargaHorariaImpresso?: string | null;
    };

    return {
      valido,
      nome: isAcademico
        ? (emissao.aluno?.nomeCompleto ?? snapshot.nomeImpresso ?? 'Desconhecido')
        : (snapshot.nomeImpresso ?? 'Parceiro Institucional / Apoiador'),
      curso: isAcademico
        ? (emissao.turma?.nome ?? snapshot.cursoImpresso ?? emissao.modelo.nome)
        : (snapshot.cursoImpresso ?? emissao.modelo.nome),
      data: emissao.dataEmissao.toLocaleDateString('pt-BR'),
      dataEmissao: emissao.dataEmissao.toLocaleDateString('pt-BR'),
      cargaHoraria: isAcademico
        ? (emissao.turma?.cargaHoraria ?? snapshot.cargaHorariaImpresso ?? 'Nao informada')
        : (snapshot.cargaHorariaImpresso ?? 'Nao se aplica'),
      codigoValidacao: emissao.codigoValidacao,
      status,
      tipo: emissao.modelo.tipo,
      mensagem: valido
        ? 'Certificado valido.'
        : 'Certificado invalido, cancelado ou substituido por uma nova versao.',
    };
  }
}
