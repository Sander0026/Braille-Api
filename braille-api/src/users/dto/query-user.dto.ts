import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class QueryUserDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filtrar por nome do usuário' })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ description: 'Listar apenas usuários inativos' })
  @Transform(({ value }: { value: any }) => value === 'true' || value === true)
  @IsOptional()
  inativos?: boolean = false;

  @ApiPropertyOptional({ description: 'Filtrar por perfil (role) do usuário', enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
