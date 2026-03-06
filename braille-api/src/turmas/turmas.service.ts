import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTurmaDto, GradeHorariaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTurmaDto } from './dto/query-turma.dto';
import { DiaSemana, TurmaStatus } from '@prisma/client';

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
  constructor(private prisma: PrismaService) { }

  async create(createTurmaDto: CreateTurmaDto) {
    const { gradeHoraria, ...dadosTurma } = createTurmaDto;

    const professor = await this.prisma.user.findUnique({ where: { id: createTurmaDto.professorId } });
    if (!professor) throw new NotFoundException('Professor não encontrado.');

    // Validar colisão de horário do professor antes de criar
    if (gradeHoraria?.length) {
      await this.validarColisaoProfessor(createTurmaDto.professorId, gradeHoraria);
    }

    return this.prisma.turma.create({
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

  async update(id: string, updateTurmaDto: UpdateTurmaDto) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const { gradeHoraria, ...dadosTurma } = updateTurmaDto as any;

    // Se o professor está mudando E há grade horária nova, validar colisão do novo professor
    const professorId = dadosTurma.professorId ?? turma.professorId;
    if (gradeHoraria?.length) {
      await this.validarColisaoProfessor(professorId, gradeHoraria, id);
    }

    return this.prisma.turma.update({
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
  }

  async arquivar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (!turma.statusAtivo) throw new BadRequestException('A turma já está arquivada.');
    return this.prisma.turma.update({ where: { id }, data: { statusAtivo: false, excluido: false } });
  }

  async restaurar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.statusAtivo && !turma.excluido) throw new BadRequestException('A turma já está ativa.');
    return this.prisma.turma.update({ where: { id }, data: { statusAtivo: true, excluido: false } });
  }

  async ocultar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.excluido) throw new BadRequestException('A turma já está oculta.');
    return this.prisma.turma.update({ where: { id }, data: { excluido: true, statusAtivo: false } });
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

    // Verificar vínculo existente
    const vinculoExistente = await this.prisma.matriculaOficina.findUnique({
      where: { alunoId_turmaId: { alunoId, turmaId } },
    });
    if (vinculoExistente?.status === 'ATIVA') {
      throw new BadRequestException('Este aluno já está matriculado nesta turma.');
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

    // Cria ou reativa o vínculo
    if (vinculoExistente) {
      return this.prisma.matriculaOficina.update({
        where: { alunoId_turmaId: { alunoId, turmaId } },
        data: { status: 'ATIVA', dataEntrada: new Date(), dataEncerramento: null },
        include: { aluno: { select: { id: true, nomeCompleto: true, matricula: true } } },
      });
    }

    return this.prisma.matriculaOficina.create({
      data: { alunoId, turmaId },
      include: { aluno: { select: { id: true, nomeCompleto: true, matricula: true } } },
    });
  }

  async removeAluno(turmaId: string, alunoId: string) {
    const vinculo = await this.prisma.matriculaOficina.findUnique({
      where: { alunoId_turmaId: { alunoId, turmaId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo de matrícula não encontrado.');

    return this.prisma.matriculaOficina.update({
      where: { alunoId_turmaId: { alunoId, turmaId } },
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

    return this.prisma.turma.update({
      where: { id },
      data: { status: novoStatus, statusAtivo },
      select: { id: true, nome: true, status: true, statusAtivo: true },
    });
  }
}

