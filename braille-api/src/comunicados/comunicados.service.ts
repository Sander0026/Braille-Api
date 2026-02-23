import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class ComunicadosService {
  
  async create(createComunicadoDto: CreateComunicadoDto) {
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } });

    if (!admin) {
      throw new NotFoundException('Administrador principal não encontrado para assinar o comunicado.');
    }

    return prisma.comunicado.create({
      data: {
        titulo: createComunicadoDto.titulo,
        conteudo: createComunicadoDto.conteudo,
        categoria: createComunicadoDto.categoria, 
        fixado: createComunicadoDto.fixado || false,
        autorId: admin.id, 
      },
    });
  }

  async findAll() {
    return prisma.comunicado.findMany({
      include: {
        autor: { select: { nome: true } } // Traz o nome de quem escreveu
      },
      orderBy: [
        { fixado: 'desc' }, // Fixados primeiro
        { criadoEm: 'desc' } // Mais novos depois
      ]
    });
  }

  async findOne(id: string) {
    const comunicado = await prisma.comunicado.findUnique({
      where: { id },
      include: { autor: { select: { nome: true } } }
    });

    if (!comunicado) throw new NotFoundException('Comunicado não encontrado.');
    return comunicado;
  }

  async update(id: string, updateComunicadoDto: UpdateComunicadoDto) {
    await this.findOne(id); // Verifica se existe antes

    return prisma.comunicado.update({
      where: { id },
      data: {
        titulo: updateComunicadoDto.titulo,
        conteudo: updateComunicadoDto.conteudo,
        categoria: updateComunicadoDto.categoria, 
        fixado: updateComunicadoDto.fixado,
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return prisma.comunicado.delete({ where: { id } });
  }
}