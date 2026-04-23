import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { TipoApoiador } from '@prisma/client';

// ── Helpers de Sanitização ───────────────────────────────────────────────────

/** Sanitiza string de texto livre: elimina espaços excessivos e caracteres nulos. */
const sanitizeString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  return value.replace(/\0/g, '').trim();
};

// ── DTOs de Ação ─────────────────────────────────────────────────────────────

export class CreateAcaoApoiadorDto {
  @IsDateString({}, { message: 'dataEvento deve ser uma data válida no formato ISO 8601.' })
  @IsNotEmpty()
  dataEvento: string;

  @IsString()
  @IsNotEmpty({ message: 'descricaoAcao não pode ser vazia.' })
  @MaxLength(500, { message: 'descricaoAcao deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  descricaoAcao: string;

  /**
   * UUID do modelo de certificado a emitir automaticamente ao adicionar a ação.
   * Opcional — se omitido, nenhum certificado é gerado.
   */
  @IsOptional()
  @IsUUID('4', { message: 'modeloCertificadoId deve ser um UUID válido.' })
  modeloCertificadoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'motivoPersonalizado deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  motivoPersonalizado?: string;
}

/**
 * PATCH de Ação — todos os campos são opcionais (PartialType).
 * Garante compatibilidade com o frontend sem breaking changes.
 */
export class UpdateAcaoApoiadorDto extends PartialType(CreateAcaoApoiadorDto) {}

// ── DTOs de Apoiador ─────────────────────────────────────────────────────────

export class CreateApoiadorDto {
  @IsEnum(TipoApoiador, { message: `tipo deve ser um dos valores: ${Object.values(TipoApoiador).join(', ')}` })
  tipo: TipoApoiador;

  @IsString()
  @IsNotEmpty({ message: 'nomeRazaoSocial não pode ser vazio.' })
  @MaxLength(200, { message: 'nomeRazaoSocial deve ter no máximo 200 caracteres.' })
  @Transform(sanitizeString)
  nomeRazaoSocial: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(sanitizeString)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18, { message: 'cpfCnpj deve ter no máximo 18 caracteres.' })
  @Transform(sanitizeString)
  cpfCnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(sanitizeString)
  contatoPessoa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(sanitizeString)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254, { message: 'email deve ter no máximo 254 caracteres.' })
  @Transform(sanitizeString)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(sanitizeString)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(sanitizeString)
  rua?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(sanitizeString)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Transform(sanitizeString)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(sanitizeString)
  atividadeEspecialidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'observacoes deve ter no máximo 2000 caracteres.' })
  @Transform(sanitizeString)
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  exibirNoSite?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateAcaoApoiadorDto)
  acoes?: CreateAcaoApoiadorDto[];
}

/**
 * PATCH de Apoiador — todos os campos são opcionais (PartialType).
 * Mantém compatibilidade retroativa com o frontend existente.
 */
export class UpdateApoiadorDto extends PartialType(CreateApoiadorDto) {}
