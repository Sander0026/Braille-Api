import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUrl } from 'class-validator';

export class CreateLaudoDto {
  @ApiProperty({ description: 'Data da emissão do Laudo' })
  @IsDateString()
  dataEmissao: string;

  @ApiPropertyOptional({ description: 'Nome do médico responsável' })
  @IsOptional()
  @IsString()
  medicoResponsavel?: string;

  @ApiPropertyOptional({ description: 'Detalhes clínicos complementares' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ description: 'URL estrita (S3/Cloudinary) contendo o PDF do Laudo Medico' })
  @IsUrl({}, { message: 'arquivoUrl deve ser uma URL resolúvel válida' })
  @IsNotEmpty()
  arquivoUrl: string;
}
