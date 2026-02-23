import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class DashboardService {
  async getEstatisticas() {
    // Dispara todas as contagens simultaneamente para maior performance
    const [totalAlunos, totalTurmas, totalUsuarios, totalComunicados] = await Promise.all([
      prisma.aluno.count({ where: { statusAtivo: true } }),
      prisma.turma.count({ where: { statusAtivo: true } }),
      prisma.user.count({ where: { statusAtivo: true } }),
      prisma.comunicado.count(), // Conta todos os comunicados
    ]);

    // Retorna um objeto pronto para o Angular desenhar os "Cards" na tela
    return {
      alunosAtivos: totalAlunos,
      turmasAtivas: totalTurmas,
      membrosEquipe: totalUsuarios,
      comunicadosGerais: totalComunicados,
    };
  }
}