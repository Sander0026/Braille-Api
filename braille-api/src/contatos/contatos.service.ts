import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContatoDto } from './dto/create-contato.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueryContatoDto } from './dto/query-contato.dto';

@Injectable()
export class ContatosService {
  constructor(private prisma: PrismaService) { }

  async create(createContatoDto: CreateContatoDto) {
    return this.prisma.mensagemContato.create({ data: createContatoDto });
  }

  async findAll(query: QueryContatoDto) {
    const { page = 1, limit = 20, lida } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (lida !== undefined) whereCondicao.lida = lida;

    const [mensagens, total] = await Promise.all([
      this.prisma.mensagemContato.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.mensagemContato.count({ where: whereCondicao }),
    ]);

    return {
      data: mensagens,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const mensagem = await this.prisma.mensagemContato.findUnique({ where: { id } });
    if (!mensagem) throw new NotFoundException('Mensagem não encontrada');
    return mensagem;
  }

  async marcarComoLida(id: string) {
    await this.findOne(id);
    return this.prisma.mensagemContato.update({
      where: { id },
      data: { lida: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.mensagemContato.delete({ where: { id } });
  }
}