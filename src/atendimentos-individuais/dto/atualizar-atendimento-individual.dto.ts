import { PartialType } from '@nestjs/swagger';
import { CriarAtendimentoIndividualDto } from './criar-atendimento-individual.dto';

/**
 * DTO de atualização de atendimento individual.
 * Herda todas as propriedades de CriarAtendimentoIndividualDto mas as torna opcionais.
 */
export class AtualizarAtendimentoIndividualDto extends PartialType(CriarAtendimentoIndividualDto) {}
