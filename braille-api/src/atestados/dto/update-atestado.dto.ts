import { PartialType } from '@nestjs/mapped-types';
import { CreateAtestadoDto } from './create-atestado.dto';

/**
 * DTO de atualização parcial de atestado.
 *
 * Herda via PartialType: todos os campos do CreateAtestadoDto tornam-se
 * opcionais, mantendo todos os decorators de validação (@MaxLength, @IsUrl,
 * @Transform, etc.) sem duplicação de código.
 *
 * Atenção: no PATCH de atestado, apenas motivo e arquivoUrl são editáveis.
 * As datas (dataInicio, dataFim) não são alteráveis após criação — validação
 * de negócio aplicada no Service.
 */
export class UpdateAtestadoDto extends PartialType(CreateAtestadoDto) {}
