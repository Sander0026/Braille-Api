import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComunicadosService {
  constructor(private prisma: PrismaService) { }

  async create(createComunicadoDto: CreateComunicadoDto) {
    const admin = await this.prisma.user.findFirst({ where: { username: 'admin' } });

    if (!admin) {
      throw new NotFoundException('Administrador principal não encontrado para assinar o comunicado.');
    }

    return this.prisma.comunicado.create({
      data: {
        titulo: createComunicadoDto.titulo,
        conteudo: createComunicadoDto.conteudo,
        categoria: createComunicadoDto.categoria,
        fixado: createComunicadoDto.fixado || false,
        autorId: admin.id,
        imagemCapa: createComunicadoDto.imagemCapa,
      },
    });
  }

  async findAll(query: import('./dto/query-comunicado.dto').QueryComunicadoDto = {}) {
    const { page = 1, limit = 10, titulo, categoria } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (titulo) {
      where.titulo = { contains: titulo, mode: 'insensitive' };
    }
    if (categoria) {
      where.categoria = categoria; // Enum CategoriaComunicado
    }

    const [data, total] = await Promise.all([
      this.prisma.comunicado.findMany({
        where,
        skip,
        take: limit,
        include: { autor: { select: { nome: true } } },
        orderBy: [
          { fixado: 'desc' },
          { criadoEm: 'desc' },
        ],
      }),
      this.prisma.comunicado.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      include: { autor: { select: { nome: true } } }
    });

    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');
    return comunicado;
  }

  async update(id: string, updateComunicadoDto: UpdateComunicadoDto) {
    await this.findOne(id);

    return this.prisma.comunicado.update({
      where: { id },
      data: {
        titulo: updateComunicadoDto.titulo,
        conteudo: updateComunicadoDto.conteudo,
        categoria: updateComunicadoDto.categoria,
        fixado: updateComunicadoDto.fixado,
        imagemCapa: updateComunicadoDto.imagemCapa,
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.comunicado.delete({ where: { id } });
  }
}