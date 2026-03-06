import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Filtro global para interceptar exceções geradas pelo Prisma ORM (Banco de Dados).
 * Em vez do NestJS retornar um erro 500 fatal e feio ("Internal Server Error") expondo o stack trace
 * ou nomes de colunas do banco, este filtro amortece o erro e envia um JSON amigável e seguro.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Ocorreu um erro interno no banco de dados. Contate o suporte.';

        switch (exception.code) {
            case 'P2002': // Unique constraint failed (Ex: Tentou salvar um CPF que já existe)
                status = HttpStatus.CONFLICT;
                const target = exception.meta?.target as string[];
                message = `Violação de regra única. O campo '${target ? target.join(', ') : 'informado'}' já está em uso.`;
                break;

            case 'P2003': // Foreign key constraint failed (Ex: Tentou deletar turma com aluno dentro)
                status = HttpStatus.BAD_REQUEST;
                message = 'Operação inválida. O registro possui vínculos em outras tabelas (ex: Dependências ativas) e não pode ser apagado/modificado bruscamente.';
                break;

            case 'P2025': // Record not found
                status = HttpStatus.NOT_FOUND;
                message = 'O registro solicitado não foi encontrado no banco de dados. Ele pode ter sido removido recentemente.';
                break;

            default:
                // Caso ocorra um Pxxxxx que a gente não mapeou, o default 500 sem stack trace será ativado (Safe Fallback)
                console.error('🔥 Erro Crítico Prisma HTTP 500:', exception.message);
                break;
        }

        response.status(status).json({
            statusCode: status,
            error: HttpStatus[status],
            message: message,
        });
    }
}
