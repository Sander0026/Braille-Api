import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

const sanitizeString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\0/g, '').trim() : value;

export class EmitirCertificadoApoiadorDto {
  /**
   * UUID do modelo de certificado a usar na emissão.
   * Obrigatório: @IsUUID blinda contra injeção de strings arbitrárias.
   */
  @IsUUID('4', { message: 'modeloId deve ser um UUID válido.' })
  @IsNotEmpty()
  modeloId: string;

  /**
   * UUID da ação do apoiador à qual o certificado se refere.
   * Opcional — pode ser emitido sem vínculo com ação específica.
   */
  @IsOptional()
  @IsUUID('4', { message: 'acaoId deve ser um UUID válido.' })
  acaoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'motivoPersonalizado deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  motivoPersonalizado?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dataEmissao deve ser uma data válida no formato ISO 8601.' })
  dataEmissao?: string;
}
