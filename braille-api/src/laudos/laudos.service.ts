import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class LaudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService
  ) {}

  async criar(alunoId: string, dto: CreateLaudoDto, registradoPorId: string) {
    // 1. Verificar se o aluno existe
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    // 2. Criar o laudo
    const laudo = await this.prisma.laudoMedico.create({
      data: {
        alunoId: aluno.id,
        dataEmissao: new Date(dto.dataEmissao),
        medicoResponsavel: dto.medicoResponsavel,
        descricao: dto.descricao,
        arquivoUrl: dto.arquivoUrl,
        registradoPorId,
      },
    });

    return laudo;
  }

  async listarPorAluno(alunoId: string) {
    const laudos = await this.prisma.laudoMedico.findMany({
      where: { alunoId },
      orderBy: { dataEmissao: 'desc' },
    });
    return laudos;
  }

  async remover(id: string) {
    const laudo = await this.prisma.laudoMedico.findUnique({
      where: { id },
    });

    if (!laudo) {
      throw new NotFoundException('Laudo não encontrado.');
    }

    if (laudo.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(laudo.arquivoUrl);
      } catch (e: any) {
        console.warn('Documento já estava ausente ou erro no Cloudinary:', e.message);
      }
    }

    await this.prisma.laudoMedico.delete({
      where: { id },
    });

    return { message: 'Laudo removido com sucesso.' };
  }
}
