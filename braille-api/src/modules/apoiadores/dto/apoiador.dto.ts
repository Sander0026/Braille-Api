import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { TipoApoiador } from '@prisma/client';

export class CreateApoiadorDto {
  @IsEnum(TipoApoiador)
  tipo: TipoApoiador;

  @IsString()
  nomeRazaoSocial: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsString()
  contatoPessoa?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  atividadeEspecialidade?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  exibirNoSite?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class UpdateApoiadorDto extends CreateApoiadorDto {}
