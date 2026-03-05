import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { TurmasModule } from './turmas/turmas.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FrequenciasModule } from './frequencias/frequencias.module';
import { ContatosModule } from './contatos/contatos.module';
import { UploadModule } from './upload/upload.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BeneficiariesModule,
    ComunicadosModule,
    TurmasModule,
    DashboardModule,
    FrequenciasModule,
    ContatosModule,
    UploadModule,
    SiteConfigModule,
    AuditLogModule,   // Fase 5
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Interceptor global de auditoria — captura mutações em todas as rotas
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }
