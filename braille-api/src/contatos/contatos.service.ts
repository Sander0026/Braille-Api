import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContatoDto } from './dto/create-contato.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class ContatosService {
  async create(createContatoDto: CreateContatoDto) {
    return prisma.mensagemContato.create({ data: createContatoDto });
  }

  async findAll() {
    return prisma.mensagemContato.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  async findOne(id: string) {
    const mensagem = await prisma.mensagemContato.findUnique({ where: { id } });
    if (!mensagem) throw new NotFoundException('Mensagem não encontrada');
    return mensagem;
  }

  // Marca a mensagem como lida
  async marcarComoLida(id: string) {
    await this.findOne(id);
    return prisma.mensagemContato.update({
      where: { id },
      data: { lida: true }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.mensagemContato.delete({ where: { id } });
  }
}