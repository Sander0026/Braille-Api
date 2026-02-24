import { Module } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { ContatosController } from './contatos.controller';

@Module({
  controllers: [ContatosController],
  providers: [ContatosService],
})
export class ContatosModule {}
