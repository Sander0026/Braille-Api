import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UploadService } from './src/upload/upload.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const uploadService = app.get(UploadService);
  
  try {
    const buffer = Buffer.from('PDF Dummy Content');
    const result = await uploadService.uploadPdfBuffer(buffer, 'test-cert-123.pdf');
    console.log('UPLOAD SUCESSO:', result);
  } catch (err) {
    console.error('ERRO UPLOAD:', err.message);
  }
  
  await app.close();
}
bootstrap();
