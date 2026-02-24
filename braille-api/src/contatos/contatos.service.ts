import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContatoDto } from './dto/create-contato.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContatosService {
  constructor(private prisma: PrismaService) { }

  async create(createContatoDto: CreateContatoDto) {
    return this.prisma.mensagemContato.create({ data: createContatoDto });
  }

  async findAll() {
    return this.prisma.mensagemContato.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  async findOne(id: string) {
    const mensagem = await this.prisma.mensagemContato.findUnique({ where: { id } });
    if (!mensagem) throw new NotFoundException('Mensagem não encontrada');
    return mensagem;
  }

  // Marca a mensagem como lida
  async marcarComoLida(id: string) {
    await this.findOne(id);
    return this.prisma.mensagemContato.update({
      where: { id },
      data: { lida: true }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.mensagemContato.delete({ where: { id } });
  }
}