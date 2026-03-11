import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CreateTurmaDto, GradeHorariaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTurmaDto } from './dto/query-turma.dto';
import { AuditAcao, DiaSemana, Role, TurmaStatus } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { REQUEST } from '@nestjs/core';

// Transições permitidas de status
const TRANSICOES_VALIDAS: Record<TurmaStatus, TurmaStatus[]> = {
  PREVISTA: ['ANDAMENTO', 'CANCELADA'],
  ANDAMENTO: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: ['PREVISTA'],  // Cancela → pode reativar como Prevista
};


// ─── Helpers de Colisão ──────────────────────────────────────────────────────

/** Retorna true se dois intervalos de minutos se sobrepõem. */
function intervalosColidem(a: { horaInicio: number; horaFim: number }, b: { horaInicio: number; horaFim: number }): boolean {
  return a.horaInicio < b.horaFim && b.horaInicio < a.horaFim;
}

/** Formata minutos para string legível. Ex: 840 → "14:00" */
function minutosParaHora(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

@Injectable()
export class TurmasService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogService,
    @Inject(REQUEST) private request: any,
  ) { }

  private getAutor() {
    return {
      autorId: this.request.user?.sub,
      autorNome: this.request.user?.nome,
      autorRole: this.request.user?.role as Role,
      ip: (this.request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || this.request.socket?.remoteAddress,
      userAgent: this.request.headers?.['user-agent'],
    };
  }

  async create(createTurmaDto: CreateTurmaDto) {
    const { gradeHoraria, ...dadosTurma } = createTurmaDto;

    const professor = await this.prisma.user.findUnique({ where: { id: createTurmaDto.professorId } });
    if (!professor) throw new NotFoundException('Professor não encontrado.');

    // Validar colisão de horário do professor antes de criar
    if (gradeHoraria?.length) {
      await this.validarColisaoProfessor(createTurmaDto.professorId, gradeHoraria);
    }

    const turmaNova = await this.prisma.turma.create({
      data: {
        ...dadosTurma,
        ...(gradeHoraria?.length && {
          gradeHoraria: {
            create: gradeHoraria.map(g => ({
              dia: g.dia,
              horaInicio: g.horaInicio,
              horaFim: g.horaFim,
            })),
          },
        }),
      },
      include: { gradeHoraria: true, professor: { select: { id: true, nome: true } } },
    });

    this.auditService.registrar({
      entidade: 'Turma',
      registroId: turmaNova.id,
      acao: AuditAcao.CRIAR,
      ...this.getAutor(),
      newValue: turmaNova,
    });

    return turmaNova;
  }

  async findAll(query: QueryTurmaDto) {
    const { page = 1, limit = 10, nome, professorId } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {
      excluido: query.excluido ?? false,
    };

    if (query.statusAtivo !== undefined) {
      whereCondicao.statusAtivo = query.statusAtivo;
    } else {
      whereCondicao.statusAtivo = true;
    }

    if (nome) whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    if (professorId) whereCondicao.professorId = professorId;
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
        turmas: {
          some: {
            excluido: false,
          },
        },
      },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async update(id: string, updateTurmaDto: UpdateTurmaDto) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const { gradeHoraria, ...dadosTurma } = updateTurmaDto as any;

    // Se o professor está mudando E há grade horária nova, validar colisão do novo professor
    const professorId = dadosTurma.professorId ?? turma.professorId;
    if (gradeHoraria?.length) {
      await this.validarColisaoProfessor(professorId, gradeHoraria, id);
    }

    const turmaAtualizada = await this.prisma.turma.update({
      where: { id },
      data: {
        ...dadosTurma,
        ...(gradeHoraria !== undefined && {
          gradeHoraria: {
            deleteMany: {},                  // Remove todos os horários antigos
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

    this.auditService.registrar({
      entidade: 'Turma',
      registroId: turma.id,
      acao: AuditAcao.ATUALIZAR,
      ...this.getAutor(),
      oldValue: turma,
      newValue: turmaAtualizada,
    });

    return turmaAtualizada;
  }

  async arquivar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (!turma.statusAtivo) throw new BadRequestException('A turma já está arquivada.');
    const result = await this.prisma.turma.update({ where: { id }, data: { statusAtivo: false, excluido: false } });
    this.auditService.registrar({
      entidade: 'Turma',
      registroId: id,
      acao: AuditAcao.ARQUIVAR,
      ...this.getAutor(),
      oldValue: { statusAtivo: true },
      newValue: { statusAtivo: false },
    });
    return result;
  }

  async restaurar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.statusAtivo && !turma.excluido) throw new BadRequestException('A turma já está ativa.');
    const result = await this.prisma.turma.update({ where: { id }, data: { statusAtivo: true, excluido: false } });
    this.auditService.registrar({
      entidade: 'Turma',
      registroId: id,
      acao: AuditAcao.RESTAURAR,
      ...this.getAutor(),
      oldValue: { statusAtivo: false },
      newValue: { statusAtivo: true },
    });
    return result;
  }

  async ocultar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.excluido) throw new BadRequestException('A turma já está oculta.');
    const result = await this.prisma.turma.update({ where: { id }, data: { excluido: true, statusAtivo: false } });

    this.auditService.registrar({
      entidade: 'Turma',
      registroId: id,
      acao: AuditAcao.ARQUIVAR,
      ...this.getAutor(),
      oldValue: { excluido: false, statusAtivo: turma.statusAtivo },
      newValue: { excluido: true, statusAtivo: false },
    });

    return result;
  }

  async remove(id: string) {
    return this.arquivar(id);
  }

  // ══ MÉTODOS DE MATRÍCULA (via MatriculaOficina) ══════════════════════════

  async addAluno(turmaId: string, alunoId: string) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      include: {
        _count: { select: { matriculasOficina: { where: { status: 'ATIVA' } } } },
        gradeHoraria: true,
      },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    // RA ÚNICO: verifica apenas matrícula ATIVA — não bloqueia reingressos
    // após cancelamento/evasão (o aluno pode ter histórico na mesma turma).
    const matriculaAtiva = await this.prisma.matriculaOficina.findFirst({
      where: { alunoId, turmaId, status: 'ATIVA' },
    });
    if (matriculaAtiva) {
      throw new BadRequestException('Este aluno já possui uma matrícula ativa nesta turma.');
    }

    // Trava de capacidade
    if (turma.capacidadeMaxima !== null) {
      const matriculasAtivas = (turma as any)._count.matriculasOficina;
      if (matriculasAtivas >= turma.capacidadeMaxima) {
        throw new BadRequestException(
          `Capacidade máxima da turma atingida (${turma.capacidadeMaxima} vagas). ` +
          `Aumente a capacidade na edição ou escolha outra turma.`
        );
      }
    }

    // ── ANTI-COLISÃO: Verificar choque de horário do aluno ────────────────
    if (turma.gradeHoraria.length > 0) {
      await this.validarColisaoAluno(alunoId, turma.gradeHoraria, turmaId);
    }

    // Sempre cria um novo vínculo — preserva o histórico completo de reingressos
    return this.prisma.matriculaOficina.create({
      data: { alunoId, turmaId },
      include: { aluno: { select: { id: true, nomeCompleto: true, matricula: true } } },
    });
  }

  async removeAluno(turmaId: string, alunoId: string) {
    // Busca a matrícula ATIVA mais recente (pode ter histórico de reingressos)
    const vinculo = await this.prisma.matriculaOficina.findFirst({
      where: { alunoId, turmaId, status: 'ATIVA' },
      orderBy: { criadoEm: 'desc' },
    });
    if (!vinculo) throw new NotFoundException('Matrícula ativa não encontrada para este aluno nesta turma.');

    return this.prisma.matriculaOficina.update({
      where: { id: vinculo.id },
      data: { status: 'CANCELADA', dataEncerramento: new Date() },
    });
  }


  async findOne(id: string) {
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: {
        professor: { select: { id: true, nome: true, email: true } },
        gradeHoraria: true,
        matriculasOficina: {
          where: { status: 'ATIVA' },
          select: {
            id: true, status: true, dataEntrada: true,
            aluno: { select: { id: true, nomeCompleto: true, matricula: true } },
          },
        },
      },
    });

    if (!turma) throw new NotFoundException('Turma não encontrada.');
    return turma;
  }

  // ══ VALIDAÇÕES PRIVADAS (Anti-Colisão) ══════════════════════════════════

  /**
   * Verifica se o ALUNO já tem matrícula ativa em outra turma que ocorre no mesmo dia e horário.
   * @param alunoId         ID do aluno a matricular
   * @param novosHorarios   Grade da turma onde ele será matriculado
   * @param turmaIdExcluir  ID da própria turma (para ignorar caso de rematrícula)
   */
  private async validarColisaoAluno(
    alunoId: string,
    novosHorarios: { dia: DiaSemana; horaInicio: number; horaFim: number }[],
    turmaIdExcluir: string,
  ) {
    // Busca todas as turmas ativas do aluno com sua grade horária
    const matriculasAtivas = await this.prisma.matriculaOficina.findMany({
      where: {
        alunoId,
        status: 'ATIVA',
        turmaId: { not: turmaIdExcluir },
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
              `nas ${horExistente.dia}s, conflitando com o horário da turma selecionada.`
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
    novosHorarios: { dia: DiaSemana; horaInicio: number; horaFim: number }[],
    turmaIdExcluir?: string,
  ) {
    const turmasDoProfessor = await this.prisma.turma.findMany({
      where: {
        professorId,
        statusAtivo: true,
        excluido: false,
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
              `nas ${horExistente.dia}s, conflitando com o novo horário.`
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
  async mudarStatus(id: string, novoStatus: TurmaStatus) {

    const turma = await this.prisma.turma.findUnique({
      where: { id },
      select: { id: true, status: true, nome: true },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const permitidos = TRANSICOES_VALIDAS[turma.status];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException(
        `Transição inválida: "${turma.status}" → "${novoStatus}". ` +
        `Permitidas: ${permitidos.length ? permitidos.join(', ') : 'nenhuma'}.`
      );
    }

    // Sincroniza statusAtivo: só ANDAMENTO/PREVISTA mantêm a turma ativa
    const statusAtivo = novoStatus === 'ANDAMENTO' || novoStatus === 'PREVISTA';

    const result = await this.prisma.turma.update({
      where: { id },
      data: { status: novoStatus, statusAtivo },
      select: { id: true, nome: true, status: true, statusAtivo: true },
    });

    this.auditService.registrar({
      entidade: 'Turma',
      registroId: id,
      acao: AuditAcao.MUDAR_STATUS,
      ...this.getAutor(),
      oldValue: { status: turma.status },
      newValue: { status: result.status },
    });

    return result;
  }
}

