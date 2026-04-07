import { Controller, Get, Patch, Body, UseGuards, Param, UsePipes, ValidationPipe, Req } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { getAuditUser } from '../common/helpers/audit.helper';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('CMS — Configurações do Site')
@Controller('site-config')
export class SiteConfigController {
    constructor(private readonly service: SiteConfigService) { }

    // ── Rotas PÚBLICAS (lidas pelo frontend em boot) ─────────
    @Get()
    @ApiOperation({ summary: 'Retorna todas as configurações do site (cor, logo…)' })
    getAll() {
        return this.service.getAll();
    }

    @Get('secoes')
    @ApiOperation({ summary: 'Retorna o conteúdo de todas as seções da home' })
    getSecoes() {
        return this.service.getSecoes();
    }

    @Get('secoes/:secao')
    @ApiOperation({ summary: 'Retorna o conteúdo de uma seção específica' })
    getSecao(@Param('secao') secao: string) {
        return this.service.getSecao(secao);
    }

    // ── Rotas PROTEGIDAS (somente admin/comunicacao) ─────────
    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COMUNICACAO)
    @Patch()
    @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }), new SanitizeHtmlPipe())
    @ApiOperation({ summary: 'Atualiza configurações gerais do site' })
    updateAll(@Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
        return this.service.updateMany(body, getAuditUser(req));
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COMUNICACAO)
    @Patch('secoes/:secao')
    @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }), new SanitizeHtmlPipe())
    @ApiOperation({ summary: 'Atualiza o conteúdo de uma seção' })
    updateSecao(@Param('secao') secao: string, @Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
        return this.service.updateSecao(secao, body, getAuditUser(req));
    }
}
