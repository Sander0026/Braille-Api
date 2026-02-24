import { Injectable, NotFoundException } from '@nestjs/common';
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
    const { page = 1, limit = 10, nome } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = { statusAtivo: true };
    if (nome) {
      whereCondicao.nome = { contains: nome, mode: 'insensitive' };
    }

    const [turmas, total] = await Promise.all([
      this.prisma.turma.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        include: {
          professor: { select: { id: true, nome: true, email: true } },
          alunos: { select: { id: true, nomeCompleto: true } },
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

  async remove(id: string) {
    const turma = await this.prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    return this.prisma.turma.update({
      where: { id },
      data: { statusAtivo: false },
    });
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