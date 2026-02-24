import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) { }

  async getEstatisticas() {
    // Dispara todas as contagens simultaneamente para maior performance
    const [totalAlunos, totalTurmas, totalUsuarios, totalComunicados] = await Promise.all([
      this.prisma.aluno.count({ where: { statusAtivo: true } }),
      this.prisma.turma.count({ where: { statusAtivo: true } }),
      this.prisma.user.count({ where: { statusAtivo: true } }),
      this.prisma.comunicado.count(),
    ]);

    return {
      alunosAtivos: totalAlunos,
      turmasAtivas: totalTurmas,
      membrosEquipe: totalUsuarios,
      comunicadosGerais: totalComunicados,
    };
  }
}