import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInscricaoDto } from './dto/create-inscricoe.dto';
import { PrismaClient, StatusInscricao } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class InscricoesService {
  async create(createInscricaoDto: CreateInscricaoDto) {
    return prisma.inscricao.create({
      data: {
        ...createInscricaoDto,
        dataNascimento: new Date(createInscricaoDto.dataNascimento)
      }
    });
  }

  async findAll() {
    return prisma.inscricao.findMany({
      orderBy: { criadoEm: 'desc' }
    });
  }

  async findOne(id: string) {
    const inscricao = await prisma.inscricao.findUnique({ where: { id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');
    return inscricao;
  }

  // A secretaria usa isso para aprovar ou rejeitar, e colocar uma observação
  async updateStatus(id: string, status: StatusInscricao, observacoesAdmin?: string) {
    await this.findOne(id);
    return prisma.inscricao.update({
      where: { id },
      data: { status, observacoesAdmin }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.inscricao.delete({ where: { id } });
  }
}