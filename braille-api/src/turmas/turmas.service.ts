import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class TurmasService {
  async create(createTurmaDto: CreateTurmaDto) {
    // Verifica se o professor existe antes de criar a turma
    const professor = await prisma.user.findUnique({ where: { id: createTurmaDto.professorId } });
    if (!professor) throw new NotFoundException('Professor não encontrado.');

    return prisma.turma.create({
      data: createTurmaDto,
    });
  }

  async findAll() {
    // Retorna as turmas ativas e já "puxa" os dados do professor junto (Join)
    return prisma.turma.findMany({
      where: { statusAtivo: true },
      include: {
        professor: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  async update(id: string, updateTurmaDto: UpdateTurmaDto) {
    const turma = await prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    return prisma.turma.update({
      where: { id },
      data: updateTurmaDto,
    });
  }

  async remove(id: string) {
    const turma = await prisma.turma.findUnique({ where: { id } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');

    // Soft delete da turma
    return prisma.turma.update({
      where: { id },
      data: { statusAtivo: false },
    });
  }
}