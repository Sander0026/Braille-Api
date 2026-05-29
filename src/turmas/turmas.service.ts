import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateTurmaDto, GradeHorariaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTurmaDto } from './dto/query-turma.dto';
import { AuditAcao, DiaSemana, MatriculaStatus, MotivoEncerramentoMatricula, Role, TurmaStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditUser } from '../common/interfaces/audit-user.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { calcularCargaHorariaTotal } from '../common/helpers/data.helper';
import { EncerrarMatriculaDto, STATUS_ENCERRAMENTO_MATRICULA } from './dto/encerrar-matricula.dto';
import { EventoLinhaTempoService } from '../aluno-linha-tempo/evento-linha-tempo.service';

const TRANSICOES_VALIDAS: Record<TurmaStatus, TurmaStatus[]> = {
  PREVISTA: ['ANDAMENTO', 'CANCELADA'],
  ANDAMENTO: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: ['PREVISTA'], // Cancela → pode reativar como Prevista
};

const STATUS_TURMA_EM_OPERACAO: TurmaStatus[] = [TurmaStatus.PREVISTA, TurmaStatus.ANDAMENTO];
const STATUS_TURMA_ACEITA_MATRICULA: TurmaStatus[] = STATUS_TURMA_EM_OPERACAO;
const STATUS_TURMA_CONSIDERA_CONFLITO: TurmaStatus[] = STATUS_TURMA_EM_OPERACAO;

// ─── Helpers de Colisão ──────────────────────────────────────────────────────

type HorarioGrade = { dia: DiaSemana; horaInicio: number; horaFim: number };

/** Retorna true se dois intervalos de minutos se sobrepõem. */
function intervalosColidem(a: HorarioGrade, b: HorarioGrade): boolean {
  return a.horaInicio < b.horaFim && b.horaInicio < a.horaFim;
}

/** Formata minutos para string legível. Ex: 840 → "14:00" */
function minutosParaHora(m: number): string {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

@Injectable()
export class TurmasService {
  private readonly logger = new Logger(TurmasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
    private readonly eventoLinhaTempo?: EventoLinhaTempoService,
  ) {}

  async create(createTurmaDto: CreateTurmaDto, auditUser: AuditUser) {
    const { gradeHoraria, dataInicio, dataFim, cargaHoraria, ...dadosTurma } = createTurmaDto;

    const professor = await this.prisma.user.findUnique({ where: { id: createTurmaDto.professorId } });
    if (!professor) throw new NotFoundException('Professor não encontrado.');

    if (gradeHoraria?.length) {
      this.validarGradeHoraria(gradeHoraria);
      await this.validarColisaoProfessor(createTurmaDto.professorId, gradeHoraria);
    }

    const start = dataInicio ? new Date(dataInicio) : undefined;
    const end = dataFim ? new Date(dataFim) : undefined;

    let cargaFinalStr = cargaHoraria;
    if (start && end && gradeHoraria?.length) {
      cargaFinalStr = calcularCargaHorariaTotal(start, end, gradeHoraria as any);
    }

    const statusInicial = (dadosTurma.status as TurmaStatus | undefined) ?? TurmaStatus.PREVISTA;

    try {
      const turmaNova = await this.prisma.turma.create({
        data: {
          ...dadosTurma,
          status: statusInicial,
          statusAtivo: this.statusAtivoPorStatus(statusInicial),
          ...(start && { dataInicio: start }),
          ...(end && { dataFim: end }),
          ...(cargaFinalStr && { cargaHoraria: cargaFinalStr }),
          ...(gradeHoraria?.length && {
            gradeHoraria: {
              create: gradeHoraria.map((g) => ({
                dia: g.dia,
                horaInicio: g.horaInicio,
                horaFim: g.horaFim,
              })),
            },
          }),
        },
        include: { gradeHoraria: true, professor: { select: { id: true, nome: true } } },
      });

      this.auditService
        .registrar({
          entidade: 'Turma',
          registroId: turmaNova.id,
          acao: AuditAcao.CRIAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          newValue: turmaNova,
        })
        .catch((e) => this.logger.warn(`Failure auditing Turma Create: ${e.message}`));

      return turmaNova;
    } catch (error: any) {
      this.logger.error(`[Data Leak Guard] Erro crítico ao criar turma no banco: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Não foi possível gravar a nova turma no sistema. Tente novamente mais tarde.',
      );
    }
  }

  async findAll(query: QueryTurmaDto, requester?: AuthenticatedUser) {
    const { page = 1, limit = 10, nome, professorId } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (query.excluido !== 'all') {
      whereCondicao.excluido = query.excluido ?? false;
    }

    if (query.statusAtivo !== 'all') {
      if (query.statusAtivo !== undefined) {
        whereCondicao.statusAtivo = query.statusAtivo;
      } else {
        whereCondicao.statusAtivo = true;
      }
    }

    if (nome) whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    if (requester?.role === Role.PROFESSOR) {
      whereCondicao.OR = [{ professorId: requester.sub }, { professorAuxiliarId: requester.sub }];
    } else if (professorId) {
      whereCondicao.professorId = professorId;
    }
    if (query.status) whereCondicao.status = query.status;

    const [turmas, total] = await Promise.all([
      this.prisma.turma.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        include: {
          professor: { select: { id: true, nome: true, email: true } },
          gradeHoraria: true,
          _count: { select: { matriculasOficina: { where: { status: 'ATIVA' } } } },
        },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.turma.count({ where: whereCondicao }),
    ]);

    return {
      data: turmas,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findProfessoresAtivos() {
    return this.prisma.user.findMany({
      where: {
        role: Role.PROFESSOR,
        statusAtivo: true,
        excluido: false,
      },
      select: { id: true, nome: true, role: true },
      orderBy: { nome: 'asc' },
    });
  }

  async update(id: string, updateTurmaDto: UpdateTurmaDto, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({ where: { id }, include: { gradeHoraria: true } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const { gradeHoraria, dataInicio, dataFim, cargaHoraria, ...dadosTurma } = updateTurmaDto as any;

    const professorId = dadosTurma.professorId ?? turma.professorId;
    const gradeConsiderada = gradeHoraria !== undefined ? gradeHoraria : (turma as any).gradeHoraria;

    if (gradeConsiderada?.length) {
      this.validarGradeHoraria(gradeConsiderada);
      await this.validarColisaoProfessor(professorId, gradeConsiderada, id);
    }

    const start = dataInicio ? new Date(dataInicio) : turma.dataInicio;
    const end = dataFim ? new Date(dataFim) : turma.dataFim;

    let cargaFinalStr = cargaHoraria || turma.cargaHoraria;
    if (start && end && gradeConsiderada?.length) {
      cargaFinalStr = calcularCargaHorariaTotal(start, end, gradeConsiderada);
    }

    const novoStatusTurma = dadosTurma.status as TurmaStatus | undefined;
    if (novoStatusTurma && novoStatusTurma !== turma.status) {
      this.validarTransicaoStatus(turma.status, novoStatusTurma);
    }

    const statusMatricula = novoStatusTurma ? this.statusMatriculaPorStatus(novoStatusTurma) : null;
    const motivoEncerramento = novoStatusTurma ? this.motivoEncerramentoPorStatusTurma(novoStatusTurma) : null;
    const statusAtivoResolvido = novoStatusTurma ? this.statusAtivoPorStatus(novoStatusTurma) : undefined;
    const encerradoEmLote = statusMatricula ? new Date() : null;
    const matriculasParaLinhaTempo = statusMatricula
      ? await this.prisma.matriculaOficina.findMany({
          where: { turmaId: id, status: MatriculaStatus.ATIVA },
          select: { id: true, alunoId: true, turmaId: true },
        })
      : [];

    try {
      const [turmaAtualizada] = await this.prisma.$transaction(async (tx) => {
        const t = await tx.turma.update({
          where: { id },
          data: {
            ...dadosTurma,
            ...(statusAtivoResolvido !== undefined && { statusAtivo: statusAtivoResolvido }),
            ...(start !== undefined && { dataInicio: start }),
            ...(end !== undefined && { dataFim: end }),
            ...(cargaFinalStr !== undefined && { cargaHoraria: cargaFinalStr }),
            ...(gradeHoraria !== undefined && {
              gradeHoraria: {
                deleteMany: {},
                create: gradeHoraria.map((g: GradeHorariaDto) => ({
                  dia: g.dia,
                  horaInicio: g.horaInicio,
                  horaFim: g.horaFim,
                })),
              },
            }),
          },
          include: { gradeHoraria: true, professor: { select: { id: true, nome: true } } },
        });

        if (statusMatricula) {
          const encerradoEm = encerradoEmLote ?? new Date();
          await tx.matriculaOficina.updateMany({
            where: { turmaId: id, status: MatriculaStatus.ATIVA },
            data: {
              status: statusMatricula,
              dataEncerramento: encerradoEm,
              motivoEncerramento: motivoEncerramento ?? undefined,
              encerradoEm,
              encerradoPorId: auditUser.sub || null,
            },
          });
        }

        return [t];
      });

      this.auditService
        .registrar({
          entidade: 'Turma',
          registroId: turma.id,
          acao: AuditAcao.ATUALIZAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          oldValue: turma,
          newValue: turmaAtualizada,
        })
        .catch((e) => this.logger.warn(`Failure auditing Turma Update: ${e.message}`));

      if (statusMatricula && encerradoEmLote) {
        for (const matricula of matriculasParaLinhaTempo) {
          await this.eventoLinhaTempo?.registrarEvento({
            alunoId: matricula.alunoId,
            turmaId: matricula.turmaId,
            usuarioId: auditUser.sub,
            tipo: 'ENCERRAMENTO_MATRICULA',
            origem: 'MATRICULA_OFICINA',
            origemId: matricula.id,
            chaveEvento: `MATRICULA_OFICINA:${matricula.id}:ENCERRAMENTO_MATRICULA`,
            dataEvento: encerradoEmLote,
            titulo: `Matricula ${statusMatricula.toLowerCase()}`,
            descricao: `Motivo: ${motivoEncerramento ?? 'Nao informado'}.`,
            turmaNomeSnapshot: turmaAtualizada.nome,
            usuarioNomeSnapshot: auditUser.nome,
            metadata: {
              status: statusMatricula,
              motivoEncerramento,
              origemEncerramento: 'TURMA',
              statusTurma: novoStatusTurma,
            },
          });
        }
      }

      return turmaAtualizada;
    } catch (error: any) {
      this.logger.error(`[Data Leak Guard] Transação corrompida ao atualizar a turma: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Não foi possível efetivar as alterações das turmas. Transação protegida impediu falhas.',
      );
    }
  }

  async arquivar(id: string, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (!turma.statusAtivo) throw new BadRequestException('A turma já está arquivada.');

    return this.mudarStatus(id, TurmaStatus.CANCELADA, auditUser);
  }

  async restaurar(id: string, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.status === TurmaStatus.CANCELADA) {
      return this.mudarStatus(id, TurmaStatus.PREVISTA, auditUser);
    }
    if (turma.status === TurmaStatus.CONCLUIDA) {
      throw new BadRequestException('Esta turma já está concluída.');
    }
    if (turma.statusAtivo && !turma.excluido) throw new BadRequestException('A turma já está ativa.');

    try {
      const statusAtivo = this.statusAtivoPorStatus(turma.status);
      const result = await this.prisma.turma.update({ where: { id }, data: { statusAtivo, excluido: false } });
      this.auditService
        .registrar({
          entidade: 'Turma',
          registroId: id,
          acao: AuditAcao.RESTAURAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          oldValue: { statusAtivo: false },
          newValue: { statusAtivo },
        })
        .catch((e) => this.logger.warn(e));
      return result;
    } catch (err) {
      this.logger.error(`Tentativa corrompida de restauracao da turma ${id}`, err);
      throw new InternalServerErrorException('Não foi possível restaurar turma.');
    }
  }

  async ocultar(id: string, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.excluido) throw new BadRequestException('A turma já está oculta.');

    try {
      const result = await this.prisma.turma.update({ where: { id }, data: { excluido: true, statusAtivo: false } });

      this.auditService
        .registrar({
          entidade: 'Turma',
          registroId: id,
          acao: AuditAcao.ARQUIVAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          oldValue: { excluido: false, statusAtivo: turma.statusAtivo },
          newValue: { excluido: true, statusAtivo: false },
        })
        .catch((e) => this.logger.warn(e));

      return result;
    } catch (err) {
      this.logger.error(`Tentativa corrompida de ocultacao da turma ${id}`, err);
      throw new InternalServerErrorException('Não foi possível ocultar turma.');
    }
  }

  async remove(id: string, auditUser: AuditUser) {
    return this.arquivar(id, auditUser);
  }

  // ══ MÉTODOS DE MATRÍCULA (via MatriculaOficina) ══════════════════════════

  async addAluno(turmaId: string, alunoId: string, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      include: {
        _count: { select: { matriculasOficina: { where: { status: 'ATIVA' } } } },
        gradeHoraria: true,
      },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    if (!STATUS_TURMA_ACEITA_MATRICULA.includes(turma.status)) {
      throw new BadRequestException(
        `Não é possível matricular alunos em turma com status ${turma.status}. ` +
          'Somente turmas previstas ou em andamento aceitam novas matrículas.',
      );
    }

    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    const matriculaAtiva = await this.prisma.matriculaOficina.findFirst({
      where: { alunoId, turmaId, status: 'ATIVA' },
    });
    if (matriculaAtiva) {
      throw new BadRequestException('Este aluno já possui uma matrícula ativa nesta turma.');
    }

    if (turma.capacidadeMaxima !== null) {
      const matriculasAtivas = (turma as any)._count.matriculasOficina;
      if (matriculasAtivas >= turma.capacidadeMaxima) {
        throw new BadRequestException(
          `Capacidade máxima da turma atingida (${turma.capacidadeMaxima} vagas). ` +
            `Aumente a capacidade na edição ou escolha outra turma.`,
        );
      }
    }

    if (turma.gradeHoraria.length > 0) {
      await this.validarColisaoAluno(alunoId, turma.gradeHoraria, turmaId);
    }

    try {
      const matriculaCriada = await this.prisma.matriculaOficina.create({
        data: { alunoId, turmaId },
        include: { aluno: { select: { id: true, nomeCompleto: true, matricula: true } } },
      });

      this.auditService
        .registrar({
          entidade: 'MatriculaOficina',
          registroId: matriculaCriada.id,
          acao: AuditAcao.CRIAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          newValue: { turmaId, alunoId, alunoNome: aluno.nomeCompleto },
        })
        .catch((e) => this.logger.warn(`Audit error: ${e.message}`));

      await this.eventoLinhaTempo?.registrarEvento({
        alunoId,
        turmaId,
        usuarioId: auditUser.sub,
        tipo: 'MATRICULA_TURMA',
        origem: 'MATRICULA_OFICINA',
        origemId: matriculaCriada.id,
        chaveEvento: `MATRICULA_OFICINA:${matriculaCriada.id}:MATRICULA_TURMA`,
        dataEvento: matriculaCriada.dataEntrada,
        titulo: 'Matricula em turma',
        descricao: `Aluno matriculado na turma ${turma.nome}.`,
        turmaNomeSnapshot: turma.nome,
        usuarioNomeSnapshot: auditUser.nome,
        metadata: {
          status: matriculaCriada.status,
        },
      });

      return matriculaCriada;
    } catch (err) {
      this.logger.error(`Tentativa corrompida de addAluno na turma ${turmaId}`, err);
      throw new InternalServerErrorException('Não foi possível efetivar a matrícula no Banco de Dados.');
    }
  }

  async encerrarMatricula(
    turmaId: string,
    alunoId: string,
    dto: EncerrarMatriculaDto,
    auditUser: AuditUser,
  ) {
    if (!STATUS_ENCERRAMENTO_MATRICULA.includes(dto.status)) {
      throw new BadRequestException('Status final de matrícula inválido para encerramento.');
    }

    const vinculo = await this.prisma.matriculaOficina.findFirst({
      where: { alunoId, turmaId, status: 'ATIVA' },
      orderBy: { criadoEm: 'desc' },
      include: { aluno: { select: { nomeCompleto: true } }, turma: { select: { nome: true } } },
    });
    if (!vinculo) throw new NotFoundException('Matrícula ativa não encontrada para este aluno nesta turma.');

    const encerradoEm = new Date();
    const dataEncerramento = dto.dataEncerramento ? new Date(dto.dataEncerramento) : encerradoEm;
    if (Number.isNaN(dataEncerramento.getTime())) {
      throw new BadRequestException('Data de encerramento inválida.');
    }

    const observacao = dto.observacao?.trim() || null;

    try {
      const matriculaEncerrada = await this.prisma.matriculaOficina.update({
        where: { id: vinculo.id },
        data: {
          status: dto.status,
          motivoEncerramento: dto.motivoEncerramento,
          observacao,
          dataEncerramento,
          encerradoEm,
          encerradoPorId: auditUser.sub || null,
        },
        include: {
          aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
          turma: { select: { id: true, nome: true } },
        },
      });

      this.auditService
        .registrar({
          entidade: 'MatriculaOficina',
          registroId: matriculaEncerrada.id,
          acao: AuditAcao.DESMATRICULAR,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          oldValue: {
            id: vinculo.id,
            status: 'ATIVA',
            alunoId,
            turmaId,
            alunoNome: vinculo.aluno.nomeCompleto,
            turmaNome: vinculo.turma.nome,
          },
          newValue: {
            status: dto.status,
            motivoEncerramento: dto.motivoEncerramento,
            observacao,
            dataEncerramento,
            encerradoEm,
            encerradoPorId: auditUser.sub || null,
            alunoId,
            turmaId,
            alunoNome: vinculo.aluno.nomeCompleto,
            turmaNome: vinculo.turma.nome,
          },
        })
        .catch((e) => this.logger.warn(`Audit error: ${e.message}`));

      await this.eventoLinhaTempo?.registrarEvento({
        alunoId,
        turmaId,
        usuarioId: auditUser.sub,
        tipo: 'ENCERRAMENTO_MATRICULA',
        origem: 'MATRICULA_OFICINA',
        origemId: matriculaEncerrada.id,
        chaveEvento: `MATRICULA_OFICINA:${matriculaEncerrada.id}:ENCERRAMENTO_MATRICULA`,
        dataEvento: dataEncerramento,
        titulo: `Matricula ${dto.status.toLowerCase()}`,
        descricao: `Motivo: ${dto.motivoEncerramento}. ${observacao ?? ''}`.trim(),
        turmaNomeSnapshot: vinculo.turma.nome,
        usuarioNomeSnapshot: auditUser.nome,
        metadata: {
          status: dto.status,
          motivoEncerramento: dto.motivoEncerramento,
        },
      });

      return matriculaEncerrada;
    } catch (err) {
      this.logger.error(`Tentativa corrompida de encerrarMatricula na turma ${turmaId}`, err);
      throw new InternalServerErrorException('Não foi possível encerrar matrícula no Banco de Dados.');
    }
  }

  async removeAluno(_turmaId: string, _alunoId: string, _auditUser: AuditUser) {
    throw new BadRequestException(
      'A remoção direta foi desativada. Use o encerramento de matrícula com status, motivo e data.',
    );
  }

  async findOne(id: string, requester?: AuthenticatedUser) {
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: {
        professor: { select: { id: true, nome: true, email: true } },
        gradeHoraria: true,
        matriculasOficina: {
          where: { status: 'ATIVA' },
          select: {
            id: true,
            status: true,
            dataEntrada: true,
            aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
          },
        },
      },
    });

    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (
      requester?.role === Role.PROFESSOR &&
      turma.professorId !== requester.sub &&
      turma.professorAuxiliarId !== requester.sub
    ) {
      throw new NotFoundException('Turma não encontrada.');
    }
    return turma;
  }

  async findAlunosDisponiveis(turmaId: string, nome?: string) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      include: { gradeHoraria: true },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const gradeDestino = turma.gradeHoraria;

    // Busca rápida de turmas conflitantes
    let turmasComConflitoIds: string[] = [];
    if (gradeDestino.length > 0) {
      const turmasAtivas = await this.prisma.turma.findMany({
        where: {
          excluido: false,
          status: { in: STATUS_TURMA_CONSIDERA_CONFLITO },
          id: { not: turmaId },
        },
        include: { gradeHoraria: true },
      });

      turmasComConflitoIds = turmasAtivas
        .filter((t) =>
          t.gradeHoraria.some((horExistente) =>
            gradeDestino.some(
              (horNovo) => horExistente.dia === horNovo.dia && intervalosColidem(horExistente, horNovo),
            ),
          ),
        )
        .map((t) => t.id);
    }

    // Anexa a própria turma aos IDs excluídos para evitar duplicação (não permitir aluno que já está nela)
    turmasComConflitoIds.push(turmaId);

    // Filter SQL Database nativo e O(1) de Complexidade do Backend
    return await this.prisma.aluno.findMany({
      where: {
        excluido: false,
        ...(nome ? { nomeCompleto: { contains: nome, mode: 'insensitive' } } : {}),
        matriculasOficina: {
          none: {
            status: MatriculaStatus.ATIVA,
            turmaId: { in: turmasComConflitoIds },
          },
        },
      },
      select: { id: true, nomeCompleto: true, matricula: true },
      orderBy: { nomeCompleto: 'asc' },
    });
  }

  // ══ VALIDAÇÕES PRIVADAS (Anti-Colisão) ══════════════════════════════════

  /**
   * Valida a grade enviada para uma turma antes de gravar no banco.
   * Permite múltiplos turnos no mesmo dia, mas bloqueia intervalos inválidos,
   * duplicados ou sobrepostos dentro da própria turma.
   */
  private validarGradeHoraria(grade: HorarioGrade[]): void {
    for (const horario of grade) {
      if (!Number.isInteger(horario.horaInicio) || !Number.isInteger(horario.horaFim)) {
        throw new BadRequestException('Horários da grade devem ser informados em minutos inteiros.');
      }

      if (horario.horaInicio < 0 || horario.horaFim > 1440 || horario.horaInicio >= horario.horaFim) {
        throw new BadRequestException(
          `Horário inválido em ${horario.dia}: ${minutosParaHora(horario.horaInicio)}–${minutosParaHora(
            horario.horaFim,
          )}. Use valores entre 00:00 e 24:00, com início menor que fim.`,
        );
      }
    }

    for (let i = 0; i < grade.length; i++) {
      for (let j = i + 1; j < grade.length; j++) {
        const atual = grade[i];
        const comparado = grade[j];
        if (atual.dia === comparado.dia && intervalosColidem(atual, comparado)) {
          throw new BadRequestException(
            `A grade da própria turma possui horários sobrepostos em ${atual.dia}: ` +
              `${minutosParaHora(atual.horaInicio)}–${minutosParaHora(atual.horaFim)} conflita com ` +
              `${minutosParaHora(comparado.horaInicio)}–${minutosParaHora(comparado.horaFim)}.`,
          );
        }
      }
    }
  }

  /**
   * Verifica se o ALUNO já tem matrícula ativa em outra turma que ocorre no mesmo dia e horário.
   * @param alunoId         ID do aluno a matricular
   * @param novosHorarios   Grade da turma onde ele será matriculado
   * @param turmaIdExcluir  ID da própria turma (para ignorar caso de rematrícula)
   */
  private async validarColisaoAluno(alunoId: string, novosHorarios: HorarioGrade[], turmaIdExcluir: string) {
    // Busca matrículas ativas apenas em turmas que ainda podem gerar conflito acadêmico.
    const matriculasAtivas = await this.prisma.matriculaOficina.findMany({
      where: {
        alunoId,
        status: MatriculaStatus.ATIVA,
        turmaId: { not: turmaIdExcluir },
        turma: {
          excluido: false,
          status: { in: STATUS_TURMA_CONSIDERA_CONFLITO },
        },
      },
      include: {
        turma: { include: { gradeHoraria: true } },
      },
    });

    for (const matricula of matriculasAtivas) {
      for (const horExistente of matricula.turma.gradeHoraria) {
        for (const horNovo of novosHorarios) {
          if (horExistente.dia === horNovo.dia && intervalosColidem(horExistente, horNovo)) {
            throw new BadRequestException(
              `Choque de horário detectado! O aluno já está matriculado em "${matricula.turma.nome}" ` +
                `às ${minutosParaHora(horExistente.horaInicio)}–${minutosParaHora(horExistente.horaFim)} ` +
                `nas ${horExistente.dia}s, conflitando com o horário da turma selecionada.`,
            );
          }
        }
      }
    }
  }

  /**
   * Verifica se o PROFESSOR já leciona outra turma no mesmo dia e horário.
   */
  private async validarColisaoProfessor(
    professorId: string,
    novosHorarios: HorarioGrade[],
    turmaIdExcluir?: string,
  ) {
    const turmasDoProfessor = await this.prisma.turma.findMany({
      where: {
        professorId,
        excluido: false,
        status: { in: STATUS_TURMA_CONSIDERA_CONFLITO },
        ...(turmaIdExcluir && { id: { not: turmaIdExcluir } }),
      },
      include: { gradeHoraria: true },
    });

    for (const turma of turmasDoProfessor) {
      for (const horExistente of turma.gradeHoraria) {
        for (const horNovo of novosHorarios) {
          if (horExistente.dia === horNovo.dia && intervalosColidem(horExistente, horNovo)) {
            throw new BadRequestException(
              `Choque de horário do professor! Ele já está alocado em "${turma.nome}" ` +
                `às ${minutosParaHora(horExistente.horaInicio)}–${minutosParaHora(horExistente.horaFim)} ` +
                `nas ${horExistente.dia}s, conflitando com o novo horário.`,
            );
          }
        }
      }
    }
  }

  // ══ STATUS (Ciclo de Vida da Turma) ══════════════════════════════════════

  /**
   * Muda o status acadêmico da turma.
   * PREVISTA → ANDAMENTO/CANCELADA; ANDAMENTO → CONCLUIDA/CANCELADA; CANCELADA → PREVISTA
   */
  private validarTransicaoStatus(statusAtual: TurmaStatus, novoStatus: TurmaStatus): void {
    if (statusAtual === TurmaStatus.CONCLUIDA) {
      throw new BadRequestException('Esta turma já está concluída.');
    }
    const permitidos = TRANSICOES_VALIDAS[statusAtual];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException(
        `Transição inválida: "${statusAtual}" → "${novoStatus}". ` +
          `Permitidas: ${permitidos.length ? permitidos.join(', ') : 'nenhuma'}.`,
      );
    }
  }

  private statusAtivoPorStatus(status: TurmaStatus): boolean {
    return STATUS_TURMA_EM_OPERACAO.includes(status);
  }

  private statusMatriculaPorStatus(status: TurmaStatus): MatriculaStatus | null {
    if (status === TurmaStatus.CONCLUIDA) return MatriculaStatus.CONCLUIDA;
    if (status === TurmaStatus.CANCELADA) return MatriculaStatus.CANCELADA;
    return null;
  }

  private motivoEncerramentoPorStatusTurma(status: TurmaStatus): MotivoEncerramentoMatricula | null {
    if (status === TurmaStatus.CONCLUIDA) return MotivoEncerramentoMatricula.CONCLUSAO;
    if (status === TurmaStatus.CANCELADA) return MotivoEncerramentoMatricula.CANCELAMENTO_DA_TURMA;
    return null;
  }

  private async aplicarTransicaoStatus(
    turma: { id: string; status: TurmaStatus; nome: string },
    novoStatus: TurmaStatus,
    auditUser: AuditUser,
  ) {
    const statusAtivo = this.statusAtivoPorStatus(novoStatus);
    const statusMatricula = this.statusMatriculaPorStatus(novoStatus);
    const motivoEncerramento = this.motivoEncerramentoPorStatusTurma(novoStatus);
    const encerradoEmLote = statusMatricula ? new Date() : null;
    const matriculasParaLinhaTempo = statusMatricula
      ? await this.prisma.matriculaOficina.findMany({
          where: { turmaId: turma.id, status: MatriculaStatus.ATIVA },
          select: { id: true, alunoId: true, turmaId: true },
        })
      : [];

    try {
      const [result] = await this.prisma.$transaction(async (tx) => {
        const turmaAtualizada = await tx.turma.update({
          where: { id: turma.id },
          data: { status: novoStatus, statusAtivo },
          select: { id: true, nome: true, status: true, statusAtivo: true },
        });

        if (statusMatricula) {
          const encerradoEm = encerradoEmLote ?? new Date();
          await tx.matriculaOficina.updateMany({
            where: { turmaId: turma.id, status: MatriculaStatus.ATIVA },
            data: {
              status: statusMatricula,
              dataEncerramento: encerradoEm,
              motivoEncerramento: motivoEncerramento ?? undefined,
              encerradoEm,
              encerradoPorId: auditUser.sub || null,
            },
          });
        }

        return [turmaAtualizada];
      });

      this.auditService
        .registrar({
          entidade: 'Turma',
          registroId: turma.id,
          acao: AuditAcao.MUDAR_STATUS,
          autorId: auditUser.sub,
          autorNome: auditUser.nome,
          autorRole: auditUser.role,
          ip: auditUser.ip,
          userAgent: auditUser.userAgent,
          oldValue: { status: turma.status },
          newValue: { status: result.status, statusAtivo: result.statusAtivo },
        })
        .catch((e) => this.logger.warn(`Failure auditing Turma mudarStatus: ${e.message}`));

      if (statusMatricula && encerradoEmLote) {
        for (const matricula of matriculasParaLinhaTempo) {
          await this.eventoLinhaTempo?.registrarEvento({
            alunoId: matricula.alunoId,
            turmaId: matricula.turmaId,
            usuarioId: auditUser.sub,
            tipo: 'ENCERRAMENTO_MATRICULA',
            origem: 'MATRICULA_OFICINA',
            origemId: matricula.id,
            chaveEvento: `MATRICULA_OFICINA:${matricula.id}:ENCERRAMENTO_MATRICULA`,
            dataEvento: encerradoEmLote,
            titulo: `Matricula ${statusMatricula.toLowerCase()}`,
            descricao: `Motivo: ${motivoEncerramento ?? 'Nao informado'}.`,
            turmaNomeSnapshot: result.nome,
            usuarioNomeSnapshot: auditUser.nome,
            metadata: {
              status: statusMatricula,
              motivoEncerramento,
              origemEncerramento: 'TURMA',
              statusTurma: novoStatus,
            },
          });
        }
      }

      return result;
    } catch (err) {
      this.logger.error(`Tentativa corrompida de mudarStatus da turma ${turma.id}`, err);
      throw new InternalServerErrorException('Não foi possível mudar o status da turma.');
    }
  }

  async mudarStatus(id: string, novoStatus: TurmaStatus, auditUser: AuditUser) {
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      select: { id: true, status: true, nome: true },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    this.validarTransicaoStatus(turma.status, novoStatus);
    return this.aplicarTransicaoStatus(turma, novoStatus, auditUser);

  }

  async cancelar(id: string, auditUser: AuditUser) {
    return this.mudarStatus(id, TurmaStatus.CANCELADA, auditUser);
  }

  async concluir(id: string, auditUser: AuditUser) {
    return this.mudarStatus(id, TurmaStatus.CONCLUIDA, auditUser);
  }
}
