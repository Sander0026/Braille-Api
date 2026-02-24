import { PartialType } from '@nestjs/swagger';
import { CreateContatoDto } from './create-contato.dto';

export class UpdateContatoDto extends PartialType(CreateContatoDto) {}
