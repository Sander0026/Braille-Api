import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Filtro global para interceptar PrismaClientKnownRequestError (erros de banco mapeados).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string;

        switch (exception.code) {
            case 'P2002': { // Unique constraint failed
                status = HttpStatus.CONFLICT;
                const target = exception.meta?.target as string[];
                message = `Violação de regra única. O campo '${target ? target.join(', ') : 'informado'}' já está em uso.`;
                break;
            }
            case 'P2003': { // Foreign key constraint failed
                status = HttpStatus.BAD_REQUEST;
                message = 'Operação inválida. O registro possui vínculos em outras tabelas e não pode ser apagado/modificado.';
                break;
            }
            case 'P2025': { // Record not found
                status = HttpStatus.NOT_FOUND;
                message = 'O registro solicitado não foi encontrado no banco de dados.';
                break;
            }
            default: {
                this.logger.error(`🔥 Erro Crítico Prisma HTTP 500: ${exception.code} | ${exception.message}`, exception.stack);
                message = `Erro interno no banco de dados [${exception.code}]: ${exception.message}`;
                break;
            }
        }

        response.status(status).json({
            statusCode: status,
            error: HttpStatus[status],
            message: message,
        });
    }
}

/**
 * Filtro para PrismaClientValidationError — erros de validação de tipo/campo.
 * Ex: campo obrigatório faltando, tipo incorreto, campo inexistente no schema.
 */
@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaValidationFilter.name);

    catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // Loga o erro completo para diagnóstico
        this.logger.error(`🔥 Prisma Validation Error: ${exception.message}`, exception.stack);

        response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request',
            message: `Erro de validação do banco de dados: ${exception.message.split('\n').slice(-2).join(' ')}`,
        });
    }
}
