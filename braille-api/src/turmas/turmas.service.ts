import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTurmaDto } from './dto/query-turma.dto';

@Injectable()
export class TurmasService {
  constructor(private prisma: PrismaService) { }

  async create(createTurmaDto: CreateTurmaDto) {
    const professor = await this.prisma.user.findUnique({ where: { id: createTurmaDto.professorId } });
    if (!professor) throw new NotFoundException('Professor não encontrado.');

    return this.prisma.turma.create({
      data: createTurmaDto,
    });
  }

  async findAll(query: QueryTurmaDto) {
    const { page = 1, limit = 10, nome, professorId } = query;
    const skip = (page - 1) * limit;

    // Monta o where dinamicamente baseado nos parâmetros de query
    const whereCondicao: any = {
      excluido: query.excluido ?? false,        // Por padrão nunca mostra ocultas
    };

    // Se statusAtivo foi passado explicitamente, usa o valor; senão, retorna apenas ativas
    if (query.statusAtivo !== undefined) {
      whereCondicao.statusAtivo = query.statusAtivo;
    } else {
      whereCondicao.statusAtivo = true;         // Padrão: só ativas
    }

    if (nome) {
      whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    }

    if (professorId) {
      whereCondicao.professorId = professorId;
    }

    const [turmas, total] = await Promise.all([
      this.prisma.turma.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        include: {
          professor: { select: { id: true, nome: true, email: true } },
          _count: { select: { alunos: true } },  // ← apenas a contagem, sem trazer dados
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

    return this.prisma.turma.update({
      where: { id },
      data: updateTurmaDto,
    });
  }

  // Arquivar: turma vai para a aba Arquivadas (statusAtivo=false, excluido=false)
  async arquivar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (!turma.statusAtivo) throw new BadRequestException('A turma já está arquivada.');

    return this.prisma.turma.update({
      where: { id },
      data: { statusAtivo: false, excluido: false },
    });
  }

  // Restaurar: turma volta para a aba Ativas (statusAtivo=true, excluido=false)
  async restaurar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.statusAtivo && !turma.excluido) throw new BadRequestException('A turma já está ativa.');

    return this.prisma.turma.update({
      where: { id },
      data: { statusAtivo: true, excluido: false },
    });
  }

  // Ocultar: remove da aba Arquivadas mas mantém dados no banco (excluido=true)
  async ocultar(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.excluido) throw new BadRequestException('A turma já está oculta.');

    return this.prisma.turma.update({
      where: { id },
      data: { excluido: true, statusAtivo: false },
    });
  }

  // Mantido por compatibilidade — redireciona para arquivar
  async remove(id: string) {
    return this.arquivar(id);
  }

  //  MÉTODOS DE MATRÍCULA 

  async addAluno(turmaId: string, alunoId: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    const aluno = await this.prisma.aluno.findUnique({ where: { id: alunoId } });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    return this.prisma.turma.update({
      where: { id: turmaId },
      data: {
        alunos: {
          connect: { id: alunoId },
        },
      },
      include: { alunos: { select: { id: true, nomeCompleto: true } } },
    });
  }

  async removeAluno(turmaId: string, alunoId: string) {
    return this.prisma.turma.update({
      where: { id: turmaId },
      data: {
        alunos: {
          disconnect: { id: alunoId },
        },
      },
      include: { alunos: { select: { id: true, nomeCompleto: true } } },
    });
  }

  async findOne(id: string) {
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: {
        professor: { select: { id: true, nome: true, email: true } },
        alunos: { select: { id: true, nomeCompleto: true } },
      },
    });

    if (!turma) {
      throw new NotFoundException('Turma não encontrada.');
    }

    return turma;
  }
}