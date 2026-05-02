import { PartialType } from '@nestjs/swagger';
import { CreateFrequenciaDto } from './create-frequencia.dto';

export class UpdateFrequenciaDto extends PartialType(CreateFrequenciaDto) {}

