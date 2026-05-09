import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAcao,
  CategoriaArquivoAtendimentoIndividual,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { FiltroAcompanhamentoIndividualDto } from '../dto/filtro-acompanhamento-individual.dto';
import { FiltroRelatorioAtendimentoDto } from '../dto/filtro-relatorio-atendimento.dto';
import { VerificarDuplicidadeAcompanhamentoDto } from '../dto/verificar-duplicidade-acompanhamento.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { RelatorioAtendimentoPdfService } from './relatorio-atendimento-pdf.service';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import { AtendimentosIndividuaisSanitizerService } from './atendimentos-individuais-sanitizer.service';

const ACOMPANHAMENTO_INCLUDE = {
  aluno: { select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true } },
  professor: { select: { id: true, nome: true, matricula: true, role: true } },
  _count: { select: { atendimentos: true } },
} as const;

const ARQUIVO_ATENDIMENTO_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const ARQUIVO_ATENDIMENTO_ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

const ACOMPANHAMENTO_DETALHE_INCLUDE = {
  ...ACOMPANHAMENTO_INCLUDE,
  atendimentos: {
    where: { excluidoEm: null },
    include: { arquivos: { where: { excluidoEm: null } } },
    orderBy: { dataAtendimento: 'desc' },
  },
  historicoAssuntos: {
    include: { alteradoPor: { select: { id: true, nome: true, role: true } } },
    orderBy: { criadoEm: 'desc' },
  },
} as const;

@Injectable()
export class AtendimentosIndividuaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly policy: AtendimentosIndividuaisPolicy,
    private readonly relatorioPdfService: RelatorioAtendimentoPdfService,
    private readonly sanitizer: AtendimentosIndividuaisSanitizerService,
    private readonly audit: AtendimentosIndividuaisAuditService,
  ) {}

  async criarAcompanhamento(
    dto: CriarAcompanhamentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    this.policy.assertCanCreate(authUser);

    const professorId = this.resolverProfessorId(dto.professorId, authUser);

    if (dto.primeiroAtendimento) {
      this.policy.assertCanCreateAtendimento(authUser, { professorId });
    }

    await Promise.all([
      this.validarAlunoAtivo(dto.alunoId),
      this.validarProfessorAtivo(professorId),
    ]);

    if (dto.primeiroAtendimento) {
      this.validarRegraAtendimento(dto.primeiroAtendimento);
    }

    const acompanhamento = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.acompanhamentoIndividual.create({
        data: {
          alunoId: dto.alunoId,
          professorId,
          assuntoAtual: dto.assuntoAtual,
          descricao: dto.descricao,
          ...(dto.primeiroAtendimento && {
            atendimentos: {
              create: {
                alunoId: dto.alunoId,
                professorId,
                dataAtendimento: this.parseDate(dto.primeiroAtendimento.dataAtendimento),
                horaInicio: dto.primeiroAtendimento.horaInicio,
                horaFim: dto.primeiroAtendimento.horaFim,
                duracaoMinutos: this.resolverDuracaoAtendimento(dto.primeiroAtendimento),
                modalidade: dto.primeiroAtendimento.modalidade,
                localAtendimento: dto.primeiroAtendimento.localAtendimento,
                tipoRegistro: dto.primeiroAtendimento.tipoRegistro,
                assuntoDoDia: dto.primeiroAtendimento.assuntoDoDia,
                observacao: dto.primeiroAtendimento.observacao,
                evolucao: dto.primeiroAtendimento.evolucao,
                dificuldades: dto.primeiroAtendimento.dificuldades,
                pendencias: dto.primeiroAtendimento.pendencias,
                recomendacoes: dto.primeiroAtendimento.recomendacoes,
                criadoPorId: auditUser.sub || undefined,
              },
            },
          }),
        },
        include: ACOMPANHAMENTO_DETALHE_INCLUDE,
      });

      return criado;
    });

    this.registrarAuditoria('AcompanhamentoIndividual', acompanhamento.id, AuditAcao.CRIAR, auditUser, undefined, {
      alunoId: acompanhamento.alunoId,
      professorId: acompanhamento.professorId,
      status: acompanhamento.status,
      dataInicio: acompanhamento.dataInicio,
      possuiPrimeiroAtendimento: Boolean(dto.primeiroAtendimento),
    });
    return this.sanitizarAcompanhamento(acompanhamento);
  }

  async listarAcompanhamentos(query: FiltroAcompanhamentoIndividualDto, authUser?: AuthenticatedUser) {
    if (query.status === StatusAcompanhamentoIndividual.ARQUIVADO) {
      this.policy.assertCanViewArchivedList(authUser);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.montarWhereAcompanhamento(query, authUser);

    const [data, total] = await Promise.all([
      this.prisma.acompanhamentoIndividual.findMany({
        where,
        skip,
        take: limit,
        include: ACOMPANHAMENTO_INCLUDE,
        orderBy: { atualizadoEm: 'desc' },
      }),
      this.prisma.acompanhamentoIndividual.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async buscarAcompanhamento(id: string, authUser?: AuthenticatedUser) {
    const acompanhamento = await this.prisma.acompanhamentoIndividual.findFirst({
      where: { id, excluidoEm: null },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    if (!acompanhamento) throw new NotFoundException('Acompanhamento individual nao encontrado.');
    this.policy.assertCanView(authUser, acompanhamento);
    return this.sanitizarAcompanhamento(acompanhamento);
  }

  async atualizarAssunto(
    id: string,
    dto: AtualizarAssuntoAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanUpdateSubject(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Nao e possivel alterar assunto de acompanhamento finalizado ou arquivado.');
    }

    if (acompanhamento.assuntoAtual === dto.assuntoAtual) return this.sanitizarAcompanhamento(acompanhamento);

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        assuntoAtual: dto.assuntoAtual,
        historicoAssuntos: {
          create: {
            assuntoAnterior: acompanhamento.assuntoAtual,
            assuntoNovo: dto.assuntoAtual,
            motivoAlteracao: dto.motivoAlteracao,
            alteradoPorId: auditUser.sub || undefined,
          },
        },
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.ATUALIZAR, auditUser, {
      assuntoAtual: acompanhamento.assuntoAtual,
    }, {
      assuntoAtual: atualizado.assuntoAtual,
      motivoAlteracao: dto.motivoAlteracao,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async finalizarAcompanhamento(
    id: string,
    dto: FinalizarAcompanhamentoDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanFinish(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Acompanhamento individual ja esta finalizado ou arquivado.');
    }

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: StatusAcompanhamentoIndividual.FINALIZADO,
        dataFinalizacao: new Date(),
        resultadoFinal: dto.resultadoFinal,
        resumoFinal: dto.resumoFinal,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      dataFinalizacao: atualizado.dataFinalizacao,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async reabrirAcompanhamento(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanReopen(authUser);

    if (acompanhamento.status === StatusAcompanhamentoIndividual.ARQUIVADO) {
      throw new ConflictException('Desarquive o acompanhamento antes de reabri-lo.');
    }

    if (acompanhamento.status === StatusAcompanhamentoIndividual.EM_ANDAMENTO) return this.sanitizarAcompanhamento(acompanhamento);

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
        dataFinalizacao: null,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
      dataFinalizacao: acompanhamento.dataFinalizacao,
    }, {
      status: atualizado.status,
      dataFinalizacao: atualizado.dataFinalizacao,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async arquivarAcompanhamento(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanArchive(authUser);

    if (acompanhamento.status === StatusAcompanhamentoIndividual.ARQUIVADO) return this.sanitizarAcompanhamento(acompanhamento);

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: StatusAcompanhamentoIndividual.ARQUIVADO,
        statusAntesArquivamento: acompanhamento.status,
        arquivadoEm: new Date(),
        arquivadoPorId: auditUser.sub || undefined,
        desarquivadoEm: null,
        desarquivadoPorId: null,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      arquivadoEm: atualizado.arquivadoEm,
      arquivadoPorId: atualizado.arquivadoPorId,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async desarquivarAcompanhamento(id: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanArchive(authUser);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.ARQUIVADO) return this.sanitizarAcompanhamento(acompanhamento);

    const statusRestaurado = acompanhamento.statusAntesArquivamento === StatusAcompanhamentoIndividual.FINALIZADO
      ? StatusAcompanhamentoIndividual.FINALIZADO
      : StatusAcompanhamentoIndividual.EM_ANDAMENTO;

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        status: statusRestaurado,
        statusAntesArquivamento: null,
        desarquivadoEm: new Date(),
        desarquivadoPorId: auditUser.sub || undefined,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      desarquivadoEm: atualizado.desarquivadoEm,
      desarquivadoPorId: atualizado.desarquivadoPorId,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async criarAtendimento(
    acompanhamentoId: string,
    dto: CriarAtendimentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    this.validarRegraAtendimento(dto);
    const acompanhamento = await this.buscarAcompanhamento(acompanhamentoId, authUser);
    this.policy.assertCanCreateAtendimento(authUser, acompanhamento);

    if (acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Nao e possivel registrar atendimento em acompanhamento finalizado ou arquivado.');
    }

    const atendimento = await this.prisma.atendimentoIndividual.create({
      data: {
        acompanhamentoId,
        alunoId: acompanhamento.alunoId,
        professorId: acompanhamento.professorId,
        dataAtendimento: this.parseDate(dto.dataAtendimento),
        horaInicio: dto.horaInicio,
        horaFim: dto.horaFim,
        duracaoMinutos: this.resolverDuracaoAtendimento(dto),
        modalidade: dto.modalidade,
        localAtendimento: dto.localAtendimento,
        tipoRegistro: dto.tipoRegistro,
        assuntoDoDia: dto.assuntoDoDia,
        observacao: dto.observacao,
        evolucao: dto.evolucao,
        dificuldades: dto.dificuldades,
        pendencias: dto.pendencias,
        recomendacoes: dto.recomendacoes,
        criadoPorId: auditUser.sub || undefined,
      },
      include: { arquivos: { where: { excluidoEm: null } } },
    });

    this.registrarAuditoria('AtendimentoIndividual', atendimento.id, AuditAcao.CRIAR, auditUser, undefined, {
      acompanhamentoId,
      alunoId: atendimento.alunoId,
      professorId: atendimento.professorId,
      tipoRegistro: atendimento.tipoRegistro,
      dataAtendimento: atendimento.dataAtendimento,
    });
    return this.sanitizarAtendimento(atendimento);
  }

  async listarAtendimentos(acompanhamentoId: string, authUser?: AuthenticatedUser) {
    const acompanhamento = await this.buscarAcompanhamento(acompanhamentoId, authUser);
    this.policy.assertCanView(authUser, acompanhamento);

    const atendimentos = await this.prisma.atendimentoIndividual.findMany({
      where: { acompanhamentoId, excluidoEm: null },
      include: { arquivos: { where: { excluidoEm: null } } },
      orderBy: { dataAtendimento: 'desc' },
    });

    return atendimentos.map((item) => this.sanitizarAtendimento(item));
  }

  async buscarAtendimento(id: string, authUser?: AuthenticatedUser) {
    const atendimento = await this.prisma.atendimentoIndividual.findFirst({
      where: { id, excluidoEm: null },
      include: {
        arquivos: { where: { excluidoEm: null } },
        acompanhamento: {
          include: {
            aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
            professor: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!atendimento) throw new NotFoundException('Atendimento individual nao encontrado.');
    this.policy.assertCanView(authUser, atendimento.acompanhamento);
    return this.sanitizarAtendimento(atendimento);
  }

  async anexarArquivo(
    atendimentoId: string,
    file: Express.Multer.File,
    categoria: CategoriaArquivoAtendimentoIndividual,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const atendimento = await this.buscarAtendimento(atendimentoId, authUser);
    this.policy.assertCanAttachFile(authUser, atendimento.acompanhamento);
    this.validarArquivoAtendimento(file);

    const upload = await this.uploadService.uploadArquivoAtendimento(file, auditUser);
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.create({
      data: {
        atendimentoId,
        nomeOriginal: file.originalname,
        nomeArquivo: this.extrairNomeArquivo(upload.url) || file.originalname,
        urlArquivo: upload.url,
        tipoArquivo: file.mimetype,
        tamanho: Math.max(file.size ?? 0, file.buffer?.length ?? 0),
        categoria,
        criadoPorId: auditUser.sub || undefined,
      },
    });

    this.registrarAuditoria('ArquivoAtendimentoIndividual', arquivo.id, AuditAcao.CRIAR, auditUser, undefined, {
      atendimentoId,
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
      tamanho: arquivo.tamanho,
    });
    return this.sanitizarArquivo(arquivo);
  }

  async gerarRelatorio(query: FiltroRelatorioAtendimentoDto, authUser?: AuthenticatedUser) {
    if (!this.policy.canGenerateReport(authUser)) {
      throw new ForbiddenException('Seu perfil nao tem permissao para gerar relatorio.');
    }

    this.validarPeriodoRelatorio(query);

    const whereAcompanhamento = this.montarWhereAcompanhamento(
      {
        alunoId: query.alunoId,
        professorId: query.professorId,
        status: query.status,
      },
      authUser,
    );

    const whereAtendimento: Prisma.AtendimentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.tipoRegistro && { tipoRegistro: query.tipoRegistro }),
      ...(query.dataInicio || query.dataFim
        ? {
            dataAtendimento: {
              ...(query.dataInicio && { gte: this.parseDate(query.dataInicio) }),
              ...(query.dataFim && { lte: this.parseDate(query.dataFim) }),
            },
          }
        : {}),
    };

    if (query.tipoRegistro || query.dataInicio || query.dataFim) {
      whereAcompanhamento.atendimentos = { some: whereAtendimento };
    }

    const acompanhamentos = await this.prisma.acompanhamentoIndividual.findMany({
      where: whereAcompanhamento,
      include: {
        aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
        professor: { select: { id: true, nome: true, matricula: true } },
        atendimentos: {
          where: whereAtendimento,
          include: { arquivos: { where: { excluidoEm: null } } },
          orderBy: { dataAtendimento: 'asc' },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const atendimentos = acompanhamentos.flatMap((item) => item.atendimentos);
    const faltasJustificadas = atendimentos.filter((item) => item.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA);
    const totais = {
      atendimentosRealizados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO),
      faltasJustificadas: faltasJustificadas.length,
      faltasJustificadasComComprovante: faltasJustificadas.filter((item: any) =>
        item.arquivos?.some((arquivo: any) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO),
      ).length,
      faltasJustificadasSemComprovante: faltasJustificadas.filter((item: any) =>
        !item.arquivos?.some((arquivo: any) => arquivo.categoria === CategoriaArquivoAtendimentoIndividual.ATESTADO),
      ).length,
      faltasNaoJustificadas: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.FALTA_NAO_JUSTIFICADA),
      cancelados: this.contar(atendimentos, TipoRegistroAtendimentoIndividual.CANCELADO),
    };

    return {
      filtros: query,
      totalAcompanhamentos: acompanhamentos.length,
      totalRegistros: atendimentos.length,
      totais,
      acompanhamentos: acompanhamentos.map((item) => this.sanitizarAcompanhamento(item)),
    };
  }

  async verificarDuplicidadeAcompanhamento(query: VerificarDuplicidadeAcompanhamentoDto, authUser?: AuthenticatedUser) {
    this.policy.assertCanCreate(authUser);

    const professorId = this.resolverProfessorId(query.professorId, authUser);
    const assuntoAtual = query.assuntoAtual.trim();

    if (!assuntoAtual) {
      throw new BadRequestException('assuntoAtual e obrigatorio.');
    }

    const acompanhamento = await this.prisma.acompanhamentoIndividual.findFirst({
      where: {
        alunoId: query.alunoId,
        professorId,
        status: StatusAcompanhamentoIndividual.EM_ANDAMENTO,
        excluidoEm: null,
        assuntoAtual: { equals: assuntoAtual, mode: 'insensitive' },
      },
      include: ACOMPANHAMENTO_INCLUDE,
      orderBy: { atualizadoEm: 'desc' },
    });

    return {
      duplicado: !!acompanhamento,
      acompanhamento,
      mensagem: acompanhamento
        ? 'Ja existe um acompanhamento em andamento para este aluno, professor e assunto.'
        : null,
    };
  }

  async obterArquivoParaDownload(id: string, authUser?: AuthenticatedUser, auditUser?: AuditUser) {
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.findUnique({
      where: { id },
      include: {
        atendimento: {
          include: {
            acompanhamento: {
              select: { id: true, alunoId: true, professorId: true },
            },
          },
        },
      },
    });

    if (!arquivo || arquivo.excluidoEm) throw new NotFoundException('Arquivo do atendimento nao encontrado.');
    this.policy.assertCanView(authUser, arquivo.atendimento.acompanhamento);
    if (auditUser) {
      this.registrarAuditoria('ArquivoAtendimentoIndividual', arquivo.id, AuditAcao.DOWNLOAD, auditUser, undefined, {
        arquivoId: arquivo.id,
        atendimentoId: arquivo.atendimentoId,
        acompanhamentoId: arquivo.atendimento.acompanhamento.id,
        alunoId: arquivo.atendimento.alunoId,
        professorId: arquivo.atendimento.professorId,
        categoria: arquivo.categoria,
        tipoArquivo: arquivo.tipoArquivo,
        usuarioId: auditUser.sub,
        baixadoEm: new Date().toISOString(),
      });
    }

    return {
      url: arquivo.urlArquivo,
      nomeOriginal: arquivo.nomeOriginal,
      tipoArquivo: arquivo.tipoArquivo,
    };
  }

  async arquivarArquivoAtendimento(
    id: string,
    motivoExclusao: string | undefined,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ) {
    const arquivo = await this.prisma.arquivoAtendimentoIndividual.findUnique({
      where: { id },
      include: {
        atendimento: {
          include: {
            acompanhamento: {
              select: { id: true, alunoId: true, professorId: true },
            },
          },
        },
      },
    });

    if (!arquivo || arquivo.excluidoEm) throw new NotFoundException('Arquivo do atendimento nao encontrado.');

    this.policy.assertCanRemoveFile(authUser, arquivo.atendimento.acompanhamento, arquivo.criadoPorId);

    const atualizado = await this.prisma.arquivoAtendimentoIndividual.update({
      where: { id },
      data: {
        excluidoEm: new Date(),
        excluidoPorId: auditUser.sub || undefined,
        motivoExclusao,
      },
    });

    this.registrarAuditoria('ArquivoAtendimentoIndividual', id, AuditAcao.ARQUIVAR, auditUser, {
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
    }, {
      arquivoId: arquivo.id,
      atendimentoId: arquivo.atendimentoId,
      acompanhamentoId: arquivo.atendimento.acompanhamento.id,
      alunoId: arquivo.atendimento.alunoId,
      professorId: arquivo.atendimento.professorId,
      categoria: arquivo.categoria,
      tipoArquivo: arquivo.tipoArquivo,
      excluidoEm: atualizado.excluidoEm,
      excluidoPorId: atualizado.excluidoPorId,
      motivoExclusao: atualizado.motivoExclusao,
    });

    return this.sanitizarArquivo(atualizado);
  }

  async gerarRelatorioPdf(query: FiltroRelatorioAtendimentoDto, authUser?: AuthenticatedUser): Promise<Buffer> {
    const relatorio = await this.gerarRelatorio(query, authUser);
    return this.relatorioPdfService.gerar(relatorio);
  }

  private montarWhereAcompanhamento(
    query: Pick<FiltroAcompanhamentoIndividualDto, 'alunoId' | 'professorId' | 'status' | 'busca' | 'dataInicio' | 'dataFim'>,
    authUser?: AuthenticatedUser,
  ): Prisma.AcompanhamentoIndividualWhereInput {
    const where: Prisma.AcompanhamentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.alunoId && { alunoId: query.alunoId }),
      ...(query.status && { status: query.status }),
      ...(query.dataInicio || query.dataFim
        ? {
            dataInicio: {
              ...(query.dataInicio && { gte: this.parseDate(query.dataInicio) }),
              ...(query.dataFim && { lte: this.parseDate(query.dataFim) }),
            },
          }
        : {}),
    };

    if (authUser?.role === Role.PROFESSOR) {
      where.professorId = authUser.sub;
      if (!query.status) {
        where.status = { not: StatusAcompanhamentoIndividual.ARQUIVADO };
      }
    } else if (query.professorId) {
      where.professorId = query.professorId;
    }

    if (query.busca?.trim()) {
      const busca = query.busca.trim();
      where.OR = [
        { assuntoAtual: { contains: busca, mode: 'insensitive' } },
        { aluno: { nomeCompleto: { contains: busca, mode: 'insensitive' } } },
        { aluno: { matricula: { contains: busca, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private resolverProfessorId(professorId: string | undefined, authUser?: AuthenticatedUser): string {
    if (authUser?.role === Role.PROFESSOR) return authUser.sub;
    if (professorId) return professorId;
    throw new BadRequestException('professorId e obrigatorio para ADMIN ou SECRETARIA.');
  }

  private async validarAlunoAtivo(alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { id: true, statusAtivo: true, excluido: true },
    });

    if (!aluno || aluno.excluido || !aluno.statusAtivo) {
      throw new NotFoundException('Aluno ativo nao encontrado.');
    }
  }

  private async validarProfessorAtivo(professorId: string): Promise<void> {
    const professor = await this.prisma.user.findUnique({
      where: { id: professorId },
      select: { id: true, role: true, statusAtivo: true, excluido: true },
    });

    if (!professor || professor.excluido || !professor.statusAtivo || professor.role !== Role.PROFESSOR) {
      throw new NotFoundException('Professor ativo nao encontrado.');
    }
  }

  private validarRegraAtendimento(dto: CriarAtendimentoIndividualDto): void {
    this.validarHorarioAtendimento(dto);

    if (dto.tipoRegistro === TipoRegistroAtendimentoIndividual.ATENDIMENTO_REALIZADO) {
      if (!dto.assuntoDoDia?.trim()) {
        throw new BadRequestException('assuntoDoDia e obrigatorio para atendimento realizado.');
      }
      if (!dto.observacao?.trim()) {
        throw new BadRequestException('observacao e obrigatoria para atendimento realizado.');
      }
    }

    if (dto.tipoRegistro === TipoRegistroAtendimentoIndividual.FALTA_JUSTIFICADA && !dto.observacao?.trim()) {
      throw new BadRequestException('observacao deve informar o motivo da falta justificada.');
    }
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data invalida.');
    }
    return date;
  }

  private contar(
    atendimentos: Array<{ tipoRegistro: TipoRegistroAtendimentoIndividual }>,
    tipo: TipoRegistroAtendimentoIndividual,
  ): number {
    return atendimentos.filter((item) => item.tipoRegistro === tipo).length;
  }

  private sanitizarAcompanhamento<T extends Record<string, any>>(acompanhamento: T): T {
    return this.sanitizer.sanitizarAcompanhamento(acompanhamento);
  }

  private sanitizarAtendimento<T extends Record<string, any>>(atendimento: T): T {
    return this.sanitizer.sanitizarAtendimento(atendimento);
  }

  private sanitizarArquivo<T extends Record<string, any>>(arquivo: T): Omit<T, 'urlArquivo'> & { downloadUrl?: string } {
    return this.sanitizer.sanitizarArquivo(arquivo);
  }

  private validarArquivoAtendimento(file: Express.Multer.File): void {
    const lowerName = file.originalname.toLowerCase();
    const hasAllowedExtension = ARQUIVO_ATENDIMENTO_ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExtension || !ARQUIVO_ATENDIMENTO_ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Arquivo invalido. Envie PDF, PNG, JPG ou JPEG.');
    }

    const buffer = file.buffer;
    const isPdf = file.mimetype === 'application/pdf' && buffer.subarray(0, 4).toString('utf8') === '%PDF';
    const isPng = file.mimetype === 'image/png'
      && buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47;
    const isJpeg = (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg')
      && buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;

    if (!isPdf && !isPng && !isJpeg) {
      throw new BadRequestException('Assinatura do arquivo nao corresponde ao tipo informado.');
    }
  }

  private validarHorarioAtendimento(dto: CriarAtendimentoIndividualDto): void {
    if (!dto.horaInicio || !dto.horaFim) return;

    const inicio = this.converterHoraParaMinutos(dto.horaInicio);
    const fim = this.converterHoraParaMinutos(dto.horaFim);

    if (fim <= inicio) {
      throw new BadRequestException('horaFim deve ser posterior a horaInicio.');
    }
  }

  private resolverDuracaoAtendimento(dto: CriarAtendimentoIndividualDto): number | undefined {
    if (dto.horaInicio && dto.horaFim) {
      return this.converterHoraParaMinutos(dto.horaFim) - this.converterHoraParaMinutos(dto.horaInicio);
    }

    return dto.duracaoMinutos;
  }

  private converterHoraParaMinutos(value: string): number {
    const [hora, minuto] = value.split(':').map(Number);
    return hora * 60 + minuto;
  }

  private validarPeriodoRelatorio(query: FiltroRelatorioAtendimentoDto): void {
    if (!query.dataInicio || !query.dataFim) return;

    const inicio = this.parseDate(query.dataInicio);
    const fim = this.parseDate(query.dataFim);
    if (inicio.getTime() > fim.getTime()) {
      throw new BadRequestException('dataInicio deve ser menor ou igual a dataFim.');
    }
  }

  private extrairNomeArquivo(url: string): string | null {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '');
    } catch {
      return null;
    }
  }

  private normalizarTextoRelatorio(texto: string): string {
    return String(texto ?? '')
      .normalize('NFC')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private registrarAuditoria(
    entidade: string,
    registroId: string,
    acao: AuditAcao,
    auditUser: AuditUser,
    oldValue?: unknown,
    newValue?: unknown,
  ): void {
    this.audit.registrar(entidade, registroId, acao, auditUser, oldValue, newValue);
  }
}
