import { Injectable } from '@nestjs/common';
import {
  OrigemEventoLinhaTempo,
  Prisma,
  TipoEventoLinhaTempoAluno,
  VisibilidadeEventoLinhaTempo,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RegistrarEventoLinhaTempoData = {
  alunoId: string;
  turmaId?: string;
  usuarioId?: string;
  tipo: TipoEventoLinhaTempoAluno;
  origem: OrigemEventoLinhaTempo;
  origemId?: string;
  chaveEvento: string;
  dataEvento: Date;
  titulo: string;
  descricao?: string;
  turmaNomeSnapshot?: string;
  professorNomeSnapshot?: string;
  usuarioNomeSnapshot?: string;
  metadata?: Prisma.InputJsonValue;
  visibilidade?: VisibilidadeEventoLinhaTempo;
  sensivel?: boolean;
};

@Injectable()
export class EventoLinhaTempoService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarEvento(data: RegistrarEventoLinhaTempoData) {
    const sensivel = data.sensivel ?? this.tipoSensivel(data.tipo);
    const visibilidade = data.visibilidade ?? (sensivel ? VisibilidadeEventoLinhaTempo.RESTRITA : undefined);

    return this.prisma.eventoLinhaTempoAluno.upsert({
      where: { chaveEvento: data.chaveEvento },
      update: {
        alunoId: data.alunoId,
        turmaId: data.turmaId,
        usuarioId: data.usuarioId,
        tipo: data.tipo,
        origem: data.origem,
        origemId: data.origemId,
        dataEvento: data.dataEvento,
        titulo: data.titulo,
        descricao: data.descricao,
        turmaNomeSnapshot: data.turmaNomeSnapshot,
        professorNomeSnapshot: data.professorNomeSnapshot,
        usuarioNomeSnapshot: data.usuarioNomeSnapshot,
        metadata: data.metadata,
        visibilidade,
        sensivel,
        atualizadoEm: new Date(),
      },
      create: {
        ...data,
        visibilidade,
        sensivel,
      },
    });
  }

  private tipoSensivel(tipo: TipoEventoLinhaTempoAluno): boolean {
    return tipo === TipoEventoLinhaTempoAluno.LAUDO || tipo === TipoEventoLinhaTempoAluno.ATESTADO;
  }
}
