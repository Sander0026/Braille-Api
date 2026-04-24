import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class EmitirCertificadoApoiadorDto {
  /**
   * UUID do modelo de certificado a usar na emissão.
   * Obrigatório: @IsUUID blinda contra injeção de strings arbitrárias.
   */
  @ApiProperty({ description: 'UUID do modelo de certificado a usar na emissão' })
  @IsUUID('4', { message: 'modeloId deve ser um UUID válido.' })
  @IsNotEmpty()
  modeloId: string;

  /**
   * UUID da ação do apoiador à qual o certificado se refere.
   * Opcional — pode ser emitido sem vínculo com ação específica.
   */
  @ApiProperty({ description: 'UUID da ação/evento vinculado (opcional)', required: false })
  @IsOptional()
  @IsUUID('4', { message: 'acaoId deve ser um UUID válido.' })
  acaoId?: string;

  /**
   * Nome do evento ou ação que motivou o certificado.
   * Ex: "Doações de roupas", "Palestra de conscientização".
   * Usado para preencher as tags {{NOME_EVENTO}} e {{MOTIVO}} no template.
   */
  @ApiProperty({
    description: 'Nome do evento/ação (ex: "Doações de roupas") — preenche {{NOME_EVENTO}} no template',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'nomeEvento deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  motivoPersonalizado?: string; // mantido no DTO para não quebrar call sites internos

  /**
   * Data em que o evento/ação ocorreu (YYYY-MM-DD).
   * Preenche {{DATA_EVENTO}} e {{DATA}} no template.
   * {{DATA_EMISSAO}} é sempre gerada automaticamente pelo sistema.
   */
  @ApiProperty({
    description: 'Data do evento/ação (ISO 8601, ex: 2024-06-15) — preenche {{DATA_EVENTO}} no template',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'dataEvento deve estar no formato ISO 8601 (YYYY-MM-DD).' })
  dataEvento?: string;
}

