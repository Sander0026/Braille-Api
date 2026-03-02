import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateContatoDto {
  @ApiProperty() @IsString() @IsNotEmpty() nome: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() telefone?: string;
  @ApiProperty() @IsString() @IsNotEmpty() assunto: string;
  @ApiProperty() @IsString() @IsNotEmpty() mensagem: string;
}