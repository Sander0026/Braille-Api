import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { PrismaClient } from '@prisma/client';
import { QueryComunicadoDto } from './dto/query-comunicado.dto';

const prisma = new PrismaClient();

@Injectable()
export class ComunicadosService {
  async create(createComunicadoDto: CreateComunicadoDto) {
    return prisma.comunicado.create({
      data: {
        titulo: createComunicadoDto.titulo,
        conteudo: createComunicadoDto.conteudo,
        fixado: createComunicadoDto.fixado ?? false,
      },
    });
  }

  async findAll(query: QueryComunicadoDto) {
    const { page = 1, limit = 10, titulo } = query;
    const skip = (page - 1) * limit;

    const whereCondicao: any = {};
    if (titulo) {
      whereCondicao.titulo = { contains: titulo, mode: 'insensitive' };
    }

    const [comunicados, total] = await Promise.all([
      prisma.comunicado.findMany({
        where: whereCondicao,
        skip,
        take: limit,
        orderBy: [
          { fixado: 'desc' },
          { criadoEm: 'desc' },
        ],
      }),
      prisma.comunicado.count({ where: whereCondicao }),
    ]);

    return {
      data: comunicados,
      meta: { total, page, lastPage: Math.ceil(total / limit) },
    };
  }

  async update(id: string, updateComunicadoDto: UpdateComunicadoDto) {
    const comunicado = await prisma.comunicado.findUnique({ where: { id } });
    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');

    return prisma.comunicado.update({
      where: { id },
      data: updateComunicadoDto,
    });
  }

  async remove(id: string) {
    const comunicado = await prisma.comunicado.findUnique({ where: { id } });
    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');

    return prisma.comunicado.delete({
      where: { id },
    });
  }
}