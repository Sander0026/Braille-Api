import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object (DTO) responsável pela formatação da resposta
 * de Estatísticas da Tela Inicial (Dashboard).
 */
export class EstatisticasResponseDto {
  @ApiProperty({ description: 'Número total de alunos cadastrados e ativos no momento', example: 120 })
  alunosAtivos: number;

  @ApiProperty({ description: 'Total de turmas ativas operacionais no período', example: 10 })
  turmasAtivas: number;

  @ApiProperty({ description: 'Quantitativo de usuários da equipe escolar (Secretaria, Profs, etc)', example: 15 })
  membrosEquipe: number;

  @ApiProperty({ description: 'Número global de comunicados disparados/cadastrados', example: 89 })
  comunicadosGerais: number;
}
