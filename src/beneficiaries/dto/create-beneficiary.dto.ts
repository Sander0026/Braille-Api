import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  ValidateIf,
  MaxLength,
  IsEmail,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoDeficiencia, CausaDeficiencia, PreferenciaAcessibilidade, CorRaca } from '@prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replaceAll('\0', '').trim() : value;

export class CreateBeneficiaryDto {
  @ApiProperty({ description: 'Nome completo do beneficiário' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  nomeCompleto: string;

  @ApiProperty({ description: 'Data de nascimento no formato ISO (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  dataNascimento: string;

  @ApiPropertyOptional({ description: 'CPF do beneficiário' })
  @ValidateIf((o) => !o.rg)
  @IsString()
  @IsNotEmpty({ message: 'É obrigatório informar o CPF ou o RG.' })
  @MaxLength(14)
  @Transform(trim)
  cpf?: string;

  @ApiPropertyOptional({ description: 'RG do beneficiário' })
  @ValidateIf((o) => !o.cpf)
  @IsString()
  @IsNotEmpty({ message: 'É obrigatório informar o CPF ou o RG.' })
  @MaxLength(20)
  @Transform(trim)
  rg?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) @Transform(trim) genero?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) @Transform(trim) estadoCivil?: string;

  @ApiPropertyOptional({ enum: CorRaca })
  @IsEnum(CorRaca)
  @IsOptional()
  corRaca?: CorRaca;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(10) @Transform(trim) cep?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) @Transform(trim) rua?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) @Transform(trim) numero?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) @Transform(trim) complemento?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) @Transform(trim) bairro?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) @Transform(trim) cidade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2) @Transform(trim) uf?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) @Transform(trim) pontoReferencia?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(30) @Transform(trim) telefoneContato?: string;

  @ApiPropertyOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsOptional()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) @Transform(trim) contatoEmergencia?: string;

  @ApiPropertyOptional({ enum: TipoDeficiencia })
  @IsEnum(TipoDeficiencia)
  @IsOptional()
  tipoDeficiencia?: TipoDeficiencia;

  @ApiPropertyOptional({ enum: CausaDeficiencia })
  @IsEnum(CausaDeficiencia)
  @IsOptional()
  causaDeficiencia?: CausaDeficiencia;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) @Transform(trim) idadeOcorrencia?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() possuiLaudo?: boolean;

  @ApiPropertyOptional({ description: 'URL do laudo médico (Cloudinary)' })
  @IsUrl({ require_protocol: false, require_tld: false })
  @IsOptional()
  @MaxLength(2000)
  laudoUrl?: string;

  @ApiPropertyOptional({ description: 'URL da foto de perfil (Cloudinary)' })
  @IsUrl({ require_protocol: false, require_tld: false })
  @IsOptional()
  @MaxLength(2000)
  fotoPerfil?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) @Transform(trim) tecAssistivas?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(150) @Transform(trim) escolaridade?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(150) @Transform(trim) profissao?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) @Transform(trim) rendaFamiliar?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) @Transform(trim) beneficiosGov?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) @Transform(trim) composicaoFamiliar?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() precisaAcompanhante?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() acompOftalmologico?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) @Transform(trim) outrasComorbidades?: string;

  @ApiPropertyOptional({ enum: PreferenciaAcessibilidade })
  @IsEnum(PreferenciaAcessibilidade)
  @IsOptional()
  prefAcessibilidade?: PreferenciaAcessibilidade;

  // ── LGPD & Documentos Legais ──────────────────────────────────────────────
  @ApiPropertyOptional() @IsBoolean() @IsOptional() termoLgpdAceito?: boolean;
  @ApiPropertyOptional() @IsDateString() @IsOptional() termoLgpdAceitoEm?: string;

  @ApiPropertyOptional({ description: 'URL do Termo LGPD (Cloudinary)' })
  @IsUrl({ require_protocol: false, require_tld: false })
  @IsOptional()
  @MaxLength(2000)
  termoLgpdUrl?: string;

  @ApiPropertyOptional({ description: 'URL do Atestado Médico (Cloudinary)' })
  @IsUrl({ require_protocol: false, require_tld: false })
  @IsOptional()
  @MaxLength(2000)
  atestadoUrl?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional() atestadoEmitidoEm?: string;
}
