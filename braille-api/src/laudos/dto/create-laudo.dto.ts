import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateLaudoDto {
  @IsDateString()
  dataEmissao: string;

  @IsOptional()
  @IsString()
  medicoResponsavel?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  @IsNotEmpty()
  arquivoUrl: string;
}
