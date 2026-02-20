import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { PrismaClient } from '@prisma/client';

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

  async findAll() {
    // Retorna os fixados primeiro, e depois ordena pelos mais recentes
    return prisma.comunicado.findMany({
      orderBy: [
        { fixado: 'desc' },
        { criadoEm: 'desc' },
      ],
    });
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