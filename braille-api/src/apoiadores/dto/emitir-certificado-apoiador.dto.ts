import { IsString, IsOptional, IsDateString } from 'class-validator';

export class EmitirCertificadoApoiadorDto {
  @IsString()
  modeloId: string;

  @IsOptional()
  @IsString()
  acaoId?: string;

  @IsOptional()
  @IsString()
  motivoPersonalizado?: string;

  @IsOptional()
  @IsDateString()
  dataEmissao?: string;
}
