import { PartialType } from '@nestjs/swagger';
import { CreateInscricaoDto } from './create-inscricoe.dto';
 
export class UpdateInscricaoDto extends PartialType(CreateInscricaoDto) {}
