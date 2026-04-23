import { ApiProperty } from '@nestjs/swagger';

/**
 * Resposta padrão genérica para todas as rotas da API.
 * Encapsula o resultado para o frontend consumir de maneira padronizada.
 *
 * @example
 *   return ApiResponse.ok(aluno, 'Aluno criado com sucesso.');
 *   return ApiResponse.error('Recurso não encontrado.');
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

  // ── Factory Methods ──────────────────────────────────────────────────────

  /**
   * Cria uma resposta de sucesso.
   * Elimina o boilerplate `new ApiResponse(true, data, message)` em cada controller.
   */
  static ok<T>(data?: T, message?: string): ApiResponse<T> {
    return new ApiResponse<T>(true, data, message);
  }

  /**
   * Cria uma resposta de falha.
   * Elimina o boilerplate `new ApiResponse(false, undefined, message)`.
   */
  static error(message: string): ApiResponse<never> {
    return new ApiResponse<never>(false, undefined, message);
  }
}
