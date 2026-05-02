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
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoApoiador } from '@prisma/client';

// ── Helpers de Sanitização ───────────────────────────────────────────────────

/** Sanitiza string de texto livre: elimina espaços excessivos e caracteres nulos. */
const sanitizeString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  return value.replace(/\0/g, '').trim();
};

// ── DTOs de Ação ─────────────────────────────────────────────────────────────

export class CreateAcaoApoiadorDto {
  @ApiProperty({
    description: 'Data do evento/ação realizada pelo apoiador (formato ISO 8601)',
    example: '2025-11-15',
  })
  @IsDateString({}, { message: 'dataEvento deve ser uma data válida no formato ISO 8601.' })
  @IsNotEmpty()
  dataEvento: string;

  @ApiProperty({
    description: 'Descrição da ação realizada (máx. 500 caracteres)',
    maxLength: 500,
    example: 'Doação de 50 bengalas para novos alunos',
  })
  @IsString()
  @IsNotEmpty({ message: 'descricaoAcao não pode ser vazia.' })
  @MaxLength(500, { message: 'descricaoAcao deve ter no máximo 500 caracteres.' })
  @Transform(sanitizeString)
  descricaoAcao: string;

  /**
   * UUID do modelo de certificado a emitir automaticamente ao adicionar a ação.
   * Opcional — se omitido, nenhum certificado é gerado.
   */
  @ApiPropertyOptional({
    description: 'UUID do modelo de certificado a emitir automaticamente ao registrar a ação. Omita para não gerar certificado.',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'modeloCertificadoId deve ser um UUID válido.' })
  modeloCertificadoId?: string;

  @ApiPropertyOptional({
    description: 'Texto livre para substituir a tag {{MOTIVO}} no modelo de certificado (máx. 500 caracteres)',
    maxLength: 500,
    example: 'Apoio contínuo ao Instituto no ano de 2025',
  })
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
  @ApiProperty({
    description: 'Tipo do apoiador',
    enum: TipoApoiador,
    example: TipoApoiador.EMPRESA,
  })
  @IsEnum(TipoApoiador, { message: `tipo deve ser um dos valores: ${Object.values(TipoApoiador).join(', ')}` })
  tipo: TipoApoiador;

  @ApiProperty({
    description: 'Nome completo ou razão social do apoiador (máx. 200 caracteres)',
    maxLength: 200,
    example: 'Empresa Exemplo Ltda.',
  })
  @IsString()
  @IsNotEmpty({ message: 'nomeRazaoSocial não pode ser vazio.' })
  @MaxLength(200, { message: 'nomeRazaoSocial deve ter no máximo 200 caracteres.' })
  @Transform(sanitizeString)
  nomeRazaoSocial: string;

  @ApiPropertyOptional({ description: 'Nome fantasia (máx. 200 caracteres)', maxLength: 200, example: 'Exemplo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(sanitizeString)
  nomeFantasia?: string;

  @ApiPropertyOptional({
    description: 'CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) — máx. 18 caracteres',
    maxLength: 18,
    example: '12.345.678/0001-90',
  })
  @IsOptional()
  @IsString()
  @MaxLength(18, { message: 'cpfCnpj deve ter no máximo 18 caracteres.' })
  @Transform(sanitizeString)
  cpfCnpj?: string;

  @ApiPropertyOptional({ description: 'Nome da pessoa de contato na organização (máx. 150 caracteres)', maxLength: 150, example: 'João da Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(sanitizeString)
  contatoPessoa?: string;

  @ApiPropertyOptional({ description: 'Telefone com DDD (máx. 30 caracteres)', maxLength: 30, example: '(27) 99999-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(sanitizeString)
  telefone?: string;

  @ApiPropertyOptional({ description: 'E-mail de contato (máx. 254 caracteres)', maxLength: 254, example: 'contato@empresa.com.br' })
  @IsOptional()
  @IsString()
  @MaxLength(254, { message: 'email deve ter no máximo 254 caracteres.' })
  @Transform(sanitizeString)
  email?: string;

  @ApiPropertyOptional({ description: 'CEP (máx. 10 caracteres)', maxLength: 10, example: '29000-000' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(sanitizeString)
  cep?: string;

  @ApiPropertyOptional({ description: 'Rua/Logradouro (máx. 150 caracteres)', maxLength: 150, example: 'Rua das Flores' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(sanitizeString)
  rua?: string;

  @ApiPropertyOptional({ description: 'Número (máx. 20 caracteres)', maxLength: 20, example: '123' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(sanitizeString)
  numero?: string;

  @ApiPropertyOptional({ description: 'Complemento (máx. 100 caracteres)', maxLength: 100, example: 'Sala 4' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  complemento?: string;

  @ApiPropertyOptional({ description: 'Bairro (máx. 100 caracteres)', maxLength: 100, example: 'Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  bairro?: string;

  @ApiPropertyOptional({ description: 'Cidade (máx. 100 caracteres)', maxLength: 100, example: 'Vitória' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitizeString)
  cidade?: string;

  @ApiPropertyOptional({ description: 'UF — sigla de 2 letras', maxLength: 2, example: 'ES' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Transform(sanitizeString)
  uf?: string;

  @ApiPropertyOptional({ description: 'Atividade ou especialidade do apoiador (máx. 200 caracteres)', maxLength: 200, example: 'Fabricação de equipamentos assistivos' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(sanitizeString)
  atividadeEspecialidade?: string;

  @ApiPropertyOptional({ description: 'Observações internas (máx. 2000 caracteres) — não exibidas no site público', maxLength: 2000, example: 'Parceiro desde 2020.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'observacoes deve ter no máximo 2000 caracteres.' })
  @Transform(sanitizeString)
  observacoes?: string;

  @ApiPropertyOptional({ description: 'Se true, o apoiador aparece na seção pública de parceiros do site', default: false, example: true })
  @IsOptional()
  @IsBoolean()
  exibirNoSite?: boolean;

  @ApiPropertyOptional({ description: 'Se false, o apoiador é tratado como inativo e não aparece em listagens padrão', default: true, example: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ description: 'Lista de ações/eventos do apoiador a registrar junto com o cadastro', type: [CreateAcaoApoiadorDto] })
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
