import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';
import { UpdateLaudoDto } from './dto/update-laudo.dto';
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

  async atualizar(id: string, dto: UpdateLaudoDto) {
    const laudo = await this.prisma.laudoMedico.findUnique({
      where: { id },
    });

    if (!laudo) {
      throw new NotFoundException('Laudo não encontrado.');
    }

    // Se a imagem no DTO for diferente da salva, podemos tentar deletar a antiga
    if (dto.arquivoUrl && laudo.arquivoUrl && dto.arquivoUrl !== laudo.arquivoUrl) {
      try {
        await this.uploadService.deleteFile(laudo.arquivoUrl);
      } catch (e: any) {
        console.warn('Arquivo antigo não removido do Cloudinary:', e.message);
      }
    }

    const laudoAtualizado = await this.prisma.laudoMedico.update({
      where: { id },
      data: {
        ...(dto.dataEmissao ? { dataEmissao: new Date(dto.dataEmissao) } : {}),
        ...(dto.medicoResponsavel !== undefined ? { medicoResponsavel: dto.medicoResponsavel } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.arquivoUrl !== undefined ? { arquivoUrl: dto.arquivoUrl } : {}),
      },
    });

    return laudoAtualizado;
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
