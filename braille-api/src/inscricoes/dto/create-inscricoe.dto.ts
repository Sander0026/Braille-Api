import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString } from 'class-validator';

export class CreateInscricaoDto {
  @ApiProperty({ description: 'Nome completo do candidato' })
  @IsString()
  @IsNotEmpty()
  nomeCandidato: string;

  @ApiProperty({ description: 'Data de nascimento (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dataNascimento: string;

  @ApiProperty({ description: 'Telefone para contato' })
  @IsString()
  @IsNotEmpty()
  telefone: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Breve relato sobre a deficiência' })
  @IsString()
  @IsOptional()
  deficiencia?: string;

  @ApiProperty({ description: 'Qual oficina deseja fazer' })
  @IsString()
  @IsNotEmpty()
  oficinaInteresse: string;
}