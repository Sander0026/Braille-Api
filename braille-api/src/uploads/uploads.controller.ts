import { Controller, Post, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from '../auth/auth.guard';
import { ApiTags, ApiConsumes, ApiBody, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Uploads de Arquivos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('uploads')
export class UploadsController {
  
  @Post('imagem')
  @ApiOperation({ summary: 'Fazer upload de uma foto de perfil ou capa' })
  @ApiConsumes('multipart/form-data') //  Avisa o Swagger que é envio de arquivo
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary', //  Cria o botão de "Escolher Arquivo" no Swagger
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads', //  Salva na pasta uploads na raiz do projeto
      filename: (req, file, cb) => {
        // Gera um nome único misturando a data e um número aleatório
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    // Retorna a URL pronta para ser salva no banco de dados!
    return {
      mensagem: 'Upload realizado com sucesso!',
      url: `/uploads/${file.filename}`
    };
  }
}