import { ApiProperty } from '@nestjs/swagger';

/**
 * Resposta padrão genérica para todas as rotas da API.
 * Encapsula o resultado para o frontend consumir de maneira padronizada.
 */
export class ApiResponse<T> {
  @ApiProperty({ description: 'Indica se a operação foi bem-sucedida', example: true })
  success: boolean;

  @ApiProperty({ description: 'Mensagem descritiva da operação (opcional)', required: false })
  message?: string;

  @ApiProperty({ description: 'Carga de dados retornada na operação', required: false })
  data?: T;

  constructor(success: boolean, data?: T, message?: string) {
    this.success = success;
    this.data = data;
    this.message = message;
  }
}
