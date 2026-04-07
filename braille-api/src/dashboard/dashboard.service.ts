import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstatisticasResponseDto } from './dto/estatisticas-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) { }

  async getEstatisticas(): Promise<EstatisticasResponseDto> {
    try {
      // Dispara todas as contagens simultaneamente para maior performance
      const [totalAlunos, totalTurmas, totalUsuarios, totalComunicados] = await Promise.all([
        this.prisma.aluno.count({ where: { statusAtivo: true } }),
        this.prisma.turma.count({ where: { statusAtivo: true } }),
        this.prisma.user.count({ where: { statusAtivo: true } }),
        this.prisma.comunicado.count(),
      ]);

      const estatisticas = new EstatisticasResponseDto();
      estatisticas.alunosAtivos = totalAlunos;
      estatisticas.turmasAtivas = totalTurmas;
      estatisticas.membrosEquipe = totalUsuarios;
      estatisticas.comunicadosGerais = totalComunicados;

      return estatisticas;
    } catch (error) {
      import('@nestjs/common').then(pkg => new pkg.Logger('DashboardService').error('Falha ao contar estatísticas: ', error));
      // Data Leak Prevention: Oculta falha crua do banco lançando erro gerenciado (HttpException Filter)
      throw new InternalServerErrorException('Não foi possível obter as estatísticas do painel.');
    }
  }
}