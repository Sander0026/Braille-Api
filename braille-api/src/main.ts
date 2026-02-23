import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // 1. Ativar Validação Global (Impede dados lixo no banco)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Remove campos que não estão no DTO
    forbidNonWhitelisted: true, // Dá erro se enviarem campos extras
    transform: true, // Converte tipos automaticamente (ex: string "1" vira number 1)
  }));

  // 2. Configurar CORS (Para o Frontend Angular acessar)
  app.enableCors();

  // 3. Configurar Documentação Swagger
  const config = new DocumentBuilder()
    .setTitle('Braillix API')
    .setDescription('API de gestão para instituição de deficientes visuais')
    .setVersion('1.0')
    .addTag('beneficiaries')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('🚀 Backend rodando em: http://localhost:3000/api');
}
bootstrap();