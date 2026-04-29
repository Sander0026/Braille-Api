import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadModule } from '../upload/upload.module';

export function obterJwtSecretObrigatorio(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error('Variavel de ambiente JWT_SECRET e obrigatoria para iniciar a aplicacao.');
  }
  return secret;
}

@Module({
  imports: [
    UploadModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: obterJwtSecretObrigatorio(configService),
        signOptions: { expiresIn: '15m' }, // Token curto. Refresh Token age por 7 dias
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
})
export class AuthModule {}
