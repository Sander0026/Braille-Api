import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsDateString } from 'class-validator';
import { TipoDeficiencia, CausaDeficiencia, PreferenciaAcessibilidade } from '@prisma/client';

export class CreateBeneficiaryDto {
  @ApiProperty({ description: 'Nome completo do beneficiário' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto: string;

  @ApiProperty({ description: 'Data de nascimento no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dataNascimento: string;

  @ApiProperty({ description: 'CPF ou RG' })
  @IsString()
  @IsNotEmpty()
  cpfRg: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  genero?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estadoCivil?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() cep?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rua?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() numero?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() complemento?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bairro?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cidade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() uf?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pontoReferencia?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefoneContato?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contatoEmergencia?: string;

  @ApiPropertyOptional({ enum: TipoDeficiencia })
  @IsEnum(TipoDeficiencia)
  @IsOptional()
  tipoDeficiencia?: TipoDeficiencia;

  @ApiPropertyOptional({ enum: CausaDeficiencia })
  @IsEnum(CausaDeficiencia)
  @IsOptional()
  causaDeficiencia?: CausaDeficiencia;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idadeOcorrencia?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  possuiLaudo?: boolean;

  @ApiPropertyOptional({ description: 'URL da imagem do laudo médico no Cloudinary' })
  @IsString()
  @IsOptional()
  laudoUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tecAssistivas?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  escolaridade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  profissao?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rendaFamiliar?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  beneficiosGov?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  composicaoFamiliar?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  precisaAcompanhante?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  acompOftalmologico?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  outrasComorbidades?: string;

  @ApiPropertyOptional({ enum: PreferenciaAcessibilidade })
  @IsEnum(PreferenciaAcessibilidade)
  @IsOptional()
  prefAcessibilidade?: PreferenciaAcessibilidade;
}