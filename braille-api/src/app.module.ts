import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { AtestadosModule } from './atestados/atestados.module';
import { LaudosModule } from './laudos/laudos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Memória Cache (Fase 14) - Configurado Globalmente com vida natural padrão de 5 minutos (300.000ms)
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // Versões v5+ do Cache_Manager adotam Millisegundos
    }),
    // Bloqueia abusos de rede: máximo de 30 chamadas por IP por minuto
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30,
    }]),
    PrismaModule,
    ScheduleModule.forRoot(),  // Habilita @Cron, @Interval, @Timeout globalmente
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
    AtestadosModule,  // Módulo de Justificativas de Falta
    LaudosModule,     // Módulo de Múltiplos Laudos Médicos
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guarda Global contra Força Bruta (Throttler)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Interceptor global de auditoria — captura mutações em todas as rotas
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }
