import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Alunos (Beneficiários)')
@ApiBearerAuth() // 🔒 Diz ao Swagger que esta rota precisa do cadeado
@UseGuards(AuthGuard) // 👮 O nosso segurança trancando a porta!
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar um novo aluno' })
  create(@Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createBeneficiaryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os alunos' })
  findAll() {
    return this.beneficiariesService.findAll();
  }
}