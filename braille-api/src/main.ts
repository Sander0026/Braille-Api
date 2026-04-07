import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './common/config/swagger.config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 0. Aumentar limite de payload para uploads de imagens/laudos (padrão Express é 100kb)
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // 0.1 Segurança de Headers HTTP (Esconde as marcas do Express/NestJS contra hackers)
  app.use(helmet());

  // 0.2 Otimização em Compressão de GZIP
  app.use(compression());

  // 1. Prefixo global — todas as rotas ficam em /api/*
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://instituto-luizbraille.vercel.app',
      /\.onrender\.com$/, // Permite qualquer subdomínio do Render
    ],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // 2. Ativar Validação Global Estrita
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos que não estão no DTO
      forbidNonWhitelisted: true, // Dá erro se enviarem campos extras
      transform: true, // Converte tipos automaticamente
    }),
  );

  // 3. Documentação Swagger Extraída para utilitário centralizado (SRP)
  setupSwagger(app);

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 Backend rodando na porta ${process.env.PORT || 3000}/api`);
  console.log(`📖 Swagger disponível na porta ${process.env.PORT || 3000}/docs`);
}
bootstrap();
