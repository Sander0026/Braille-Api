import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAcao,
  Prisma,
  Role,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CriarAcompanhamentoIndividualDto } from '../dto/criar-acompanhamento-individual.dto';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AtualizarAssuntoAcompanhamentoDto } from '../dto/atualizar-assunto-acompanhamento.dto';
import { FinalizarAcompanhamentoDto } from '../dto/finalizar-acompanhamento.dto';
import { FiltroAcompanhamentoIndividualDto, STATUS_ARQUIVADO_VIRTUAL } from '../dto/filtro-acompanhamento-individual.dto';
import { VerificarDuplicidadeAcompanhamentoDto } from '../dto/verificar-duplicidade-acompanhamento.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import {
  AtendimentosIndividuaisSanitizerService,
  AcompanhamentoIndividualResponse,
  AtendimentoIndividualResponse,
} from './atendimentos-individuais-sanitizer.service';

const ACOMPANHAMENTO_INCLUDE = {
  aluno: { select: { id: true, nomeCompleto: true, matricula: true, statusAtivo: true } },
  professor: { select: { id: true, nome: true, matricula: true, role: true } },
  _count: { select: { atendimentos: true } },
} as const;



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
    private readonly policy: AtendimentosIndividuaisPolicy,
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
                horaInicioMinutos: this.resolverHoraMinutos(dto.primeiroAtendimento.horaInicio),
                horaFimMinutos: this.resolverHoraMinutos(dto.primeiroAtendimento.horaFim),
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
    if (query.status === STATUS_ARQUIVADO_VIRTUAL) {
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
      data: data.map((item) => this.sanitizarAcompanhamento(item)),
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

    if (acompanhamento.arquivado || acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
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

    if (acompanhamento.arquivado || acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
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

    if (acompanhamento.arquivado) {
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

  async arquivarAcompanhamento(id: string, motivo: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanArchive(authUser);

    if (acompanhamento.arquivado) return this.sanitizarAcompanhamento(acompanhamento);

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        arquivado: true,
        arquivadoEm: new Date(),
        arquivadoPorId: auditUser.sub || undefined,
        motivoArquivamento: motivo,
        desarquivadoEm: null,
        desarquivadoPorId: null,
        motivoDesarquivamento: null,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      arquivado: atualizado.arquivado,
      arquivadoEm: atualizado.arquivadoEm,
      arquivadoPorId: atualizado.arquivadoPorId,
      motivoArquivamento: atualizado.motivoArquivamento,
    });
    return this.sanitizarAcompanhamento(atualizado);
  }

  async desarquivarAcompanhamento(id: string, motivo: string, authUser: AuthenticatedUser | undefined, auditUser: AuditUser) {
    const acompanhamento = await this.buscarAcompanhamento(id, authUser);
    this.policy.assertCanArchive(authUser);

    if (!acompanhamento.arquivado) return this.sanitizarAcompanhamento(acompanhamento);

    const atualizado = await this.prisma.acompanhamentoIndividual.update({
      where: { id },
      data: {
        arquivado: false,
        desarquivadoEm: new Date(),
        desarquivadoPorId: auditUser.sub || undefined,
        motivoDesarquivamento: motivo,
      },
      include: ACOMPANHAMENTO_DETALHE_INCLUDE,
    });

    this.registrarAuditoria('AcompanhamentoIndividual', id, AuditAcao.MUDAR_STATUS, auditUser, {
      status: acompanhamento.status,
    }, {
      status: atualizado.status,
      arquivado: atualizado.arquivado,
      desarquivadoEm: atualizado.desarquivadoEm,
      desarquivadoPorId: atualizado.desarquivadoPorId,
      motivoDesarquivamento: atualizado.motivoDesarquivamento,
    });
    return this.sanitizarAcompanhamento(atualizado);
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
        arquivado: false,
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



  private montarWhereAcompanhamento(
    query: Pick<FiltroAcompanhamentoIndividualDto, 'alunoId' | 'professorId' | 'status' | 'busca' | 'dataInicio' | 'dataFim'>,
    authUser?: AuthenticatedUser,
  ): Prisma.AcompanhamentoIndividualWhereInput {
    const statusArquivado = query.status === STATUS_ARQUIVADO_VIRTUAL;
    const where: Prisma.AcompanhamentoIndividualWhereInput = {
      excluidoEm: null,
      ...(query.alunoId && { alunoId: query.alunoId }),
      arquivado: statusArquivado,
      ...(query.status && !statusArquivado && { status: query.status as StatusAcompanhamentoIndividual }),
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

  private sanitizarAcompanhamento(acompanhamento: any): AcompanhamentoIndividualResponse {
    return this.sanitizer.sanitizarAcompanhamento(acompanhamento);
  }

  private sanitizarAtendimento(atendimento: any): AtendimentoIndividualResponse {
    return this.sanitizer.sanitizarAtendimento(atendimento);
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

  private resolverHoraMinutos(value?: string): number | undefined {
    return value ? this.converterHoraParaMinutos(value) : undefined;
  }

  private converterHoraParaMinutos(value: string): number {
    const [hora, minuto] = value.split(':').map(Number);
    return hora * 60 + minuto;
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
