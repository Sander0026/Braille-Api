import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInscricaoDto } from './dto/create-inscricoe.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao } from '@prisma/client';

@Injectable()
export class InscricoesService {
  constructor(private prisma: PrismaService) { }

  async create(createInscricaoDto: CreateInscricaoDto) {
    return this.prisma.inscricao.create({
      data: {
        ...createInscricaoDto,
        dataNascimento: new Date(createInscricaoDto.dataNascimento)
      }
    });
  }

  async findAll() {
    return this.prisma.inscricao.findMany({
      orderBy: { criadoEm: 'desc' }
    });
  }

  async findOne(id: string) {
    const inscricao = await this.prisma.inscricao.findUnique({ where: { id } });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada');
    return inscricao;
  }

  // A secretaria usa isso para aprovar ou rejeitar, e colocar uma observação
  async updateStatus(id: string, status: StatusInscricao, observacoesAdmin?: string) {
    await this.findOne(id);
    return this.prisma.inscricao.update({
      where: { id },
      data: { status, observacoesAdmin }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.inscricao.delete({ where: { id } });
  }
}