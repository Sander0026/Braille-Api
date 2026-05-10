import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAcao,
  StatusAcompanhamentoIndividual,
  TipoRegistroAtendimentoIndividual,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuditUser } from '../../common/interfaces/audit-user.interface';
import { CriarAtendimentoIndividualDto } from '../dto/criar-atendimento-individual.dto';
import { AtendimentosIndividuaisPolicy } from '../policies/atendimentos-individuais.policy';
import { AtendimentosIndividuaisAuditService } from './atendimentos-individuais-audit.service';
import {
  AtendimentosIndividuaisSanitizerService,
  AtendimentoIndividualResponse,
} from './atendimentos-individuais-sanitizer.service';

@Injectable()
export class AtendimentosIndividuaisRegistrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AtendimentosIndividuaisPolicy,
    private readonly sanitizer: AtendimentosIndividuaisSanitizerService,
    private readonly audit: AtendimentosIndividuaisAuditService,
  ) {}

  async criar(
    acompanhamentoId: string,
    dto: CriarAtendimentoIndividualDto,
    authUser: AuthenticatedUser | undefined,
    auditUser: AuditUser,
  ): Promise<AtendimentoIndividualResponse> {
    this.validarRegraAtendimento(dto);
    const acompanhamento = await this.buscarAcompanhamentoAtivo(acompanhamentoId, authUser);
    this.policy.assertCanCreateAtendimento(authUser, acompanhamento);

    if (acompanhamento.arquivado || acompanhamento.status !== StatusAcompanhamentoIndividual.EM_ANDAMENTO) {
      throw new ConflictException('Nao e possivel registrar atendimento em acompanhamento finalizado ou arquivado.');
    }

    const atendimento = await this.prisma.atendimentoIndividual.create({
      data: {
        acompanhamentoId,
        alunoId: acompanhamento.alunoId,
        professorId: acompanhamento.professorId,
        dataAtendimento: this.parseDate(dto.dataAtendimento),
        horaInicioMinutos: this.resolverHoraMinutos(dto.horaInicio),
        horaFimMinutos: this.resolverHoraMinutos(dto.horaFim),
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

    this.audit.registrar('AtendimentoIndividual', atendimento.id, AuditAcao.CRIAR, auditUser, undefined, {
      acompanhamentoId,
      alunoId: atendimento.alunoId,
      professorId: atendimento.professorId,
      tipoRegistro: atendimento.tipoRegistro,
      dataAtendimento: atendimento.dataAtendimento,
    });

    return this.sanitizer.sanitizarAtendimento(atendimento);
  }

  async listar(acompanhamentoId: string, authUser?: AuthenticatedUser): Promise<AtendimentoIndividualResponse[]> {
    const acompanhamento = await this.buscarAcompanhamentoAtivo(acompanhamentoId, authUser);
    this.policy.assertCanView(authUser, acompanhamento);

    const atendimentos = await this.prisma.atendimentoIndividual.findMany({
      where: { acompanhamentoId, excluidoEm: null },
      include: { arquivos: { where: { excluidoEm: null } } },
      orderBy: { dataAtendimento: 'desc' },
    });

    return atendimentos.map((item) => this.sanitizer.sanitizarAtendimento(item));
  }

  async buscar(id: string, authUser?: AuthenticatedUser): Promise<AtendimentoIndividualResponse> {
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
    return this.sanitizer.sanitizarAtendimento(atendimento);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────

  private async buscarAcompanhamentoAtivo(id: string, authUser?: AuthenticatedUser) {
    const acompanhamento = await this.prisma.acompanhamentoIndividual.findFirst({
      where: { id, excluidoEm: null },
    });
    if (!acompanhamento) throw new NotFoundException('Acompanhamento individual nao encontrado.');
    this.policy.assertCanView(authUser, acompanhamento);
    return acompanhamento;
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

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data invalida.');
    }
    return date;
  }
}
