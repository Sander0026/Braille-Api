import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// ── Mensagens públicas — nunca expõem detalhes internos do banco ────────────

const MSG_PUBLICAS: Record<string, string> = {
  P2002: "Violação de regra única. O campo informado já está em uso.",
  P2003: "Operação inválida. O registro possui vínculos em outras entidades e não pode ser apagado ou modificado.",
  P2025: "O registro solicitado não foi encontrado.",
};

const MSG_DEFAULT_PUBLICO = 'Erro interno no servidor. Por favor, tente novamente.';
const MSG_VALIDACAO_PUBLICO = 'Requisição inválida. Verifique os dados enviados e tente novamente.';

/**
 * Filtro global para PrismaClientKnownRequestError (erros de banco mapeados).
 *
 * Segurança (CWE-209): a mensagem do Prisma NUNCA é retornada ao cliente —
 * pode conter nomes de tabelas, colunas e queries SQL internas.
 * O detalhe completo vai apenas para o Logger (lado servidor).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const msgPublica = MSG_PUBLICAS[exception.code];

    if (msgPublica) {
      // Erros conhecidos e mapeados: log de aviso (não é um bug, é regra de negócio)
      this.logger.warn(
        `Prisma ${exception.code} | target: ${JSON.stringify(exception.meta?.target)} | ${exception.message}`,
      );
      const status = exception.code === 'P2002'
        ? HttpStatus.CONFLICT
        : exception.code === 'P2003'
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.NOT_FOUND;

      return response.status(status).json({
        statusCode: status,
        error:      HttpStatus[status],
        message:    msgPublica,
      });
    }

    // Caso default — erro desconhecido/inesperado:
    // Loga o detalhe completo (server-side), retorna mensagem genérica (client-side).
    this.logger.error(
      `[PrismaKnown] Código não mapeado: ${exception.code} | ${exception.message}`,
      exception.stack,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error:      'Internal Server Error',
      message:    MSG_DEFAULT_PUBLICO,
    });
  }
}

/**
 * Filtro para PrismaClientValidationError — erros de tipo/campo incorretos.
 * Ex: campo obrigatório em falta, tipo incorreto, campo inexistente no schema.
 *
 * Segurança (CWE-209): a mensagem raw do Prisma contém detalhes de schema
 * (nomes de modelos, campos, tipos esperados) e NUNCA é retornada ao cliente.
 */
@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaValidationFilter.name);

  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Detalhe completo: apenas no log (server-side)
    this.logger.error(`[PrismaValidation] ${exception.message}`, exception.stack);

    return response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error:      'Bad Request',
      message:    MSG_VALIDACAO_PUBLICO,
    });
  }
}
