import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter, PrismaValidationFilter } from './common/filters/prisma-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // 2. Ativar Validação Global (Impede dados lixo no banco)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Remove campos que não estão no DTO
    forbidNonWhitelisted: true, // Dá erro se enviarem campos extras
    transform: true, // Converte tipos automaticamente (ex: string "1" vira number 1)
  }));

  // 2.1. Interceptor Global de Erros de Banco (Esconde o Prisma do Frontend)
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new PrismaValidationFilter(), // Captura erros de validação de tipo/campo
  );

  // 3. Configurar Documentação Swagger (em /docs para não conflitar com /api)
  const config = new DocumentBuilder()
    .setTitle('Braillix API')
    .setDescription('API de gestão para instituição de deficientes visuais')
    .setVersion('1.0')
    .addTag('beneficiaries')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT || 3000);
  console.log('🚀 Backend rodando em: http://localhost:3000/api');
  console.log('📖 Swagger disponível em: http://localhost:3000/docs');
}
bootstrap();
