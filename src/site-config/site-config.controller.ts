import { Controller, Get, Patch, Body, UseGuards, Param, UsePipes, ValidationPipe, Req, Inject, UseInterceptors } from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SiteConfigService } from './site-config.service';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { getAuditUser } from '../common/helpers/audit.helper';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

// Chaves de cache centralizadas — usadas tanto nos @CacheKey quanto na invalidação
const CACHE_KEYS = {
  all: 'site_config:all',
  secoes: 'site_config:secoes',
} as const;

@ApiTags('CMS — Configurações do Site')
@SkipAudit()
@Controller('site-config')
export class SiteConfigController {
  constructor(
    private readonly service: SiteConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ── Rotas PÚBLICAS (lidas pelo frontend em boot) ─────────────────────────────
  // TTL de 10 minutos — dados mudam raramente (só quando admin edita)
  // Invalidação explícita acontece nas rotas PATCH abaixo

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.all)
  @CacheTTL(600_000)
  @ApiOperation({ summary: 'Retorna todas as configurações do site (cor, logo…)' })
  @ApiResponse({ status: 200, description: 'Configurações retornadas com sucesso.' })
  getAll() {
    return this.service.getAll();
  }

  @Get('secoes')
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.secoes)
  @CacheTTL(600_000)
  @ApiOperation({ summary: 'Retorna o conteúdo de todas as seções da home' })
  @ApiResponse({ status: 200, description: 'Seções retornadas com sucesso.' })
  getSecoes() {
    return this.service.getSecoes();
  }

  @Get('secoes/:secao')
  @ApiOperation({ summary: 'Retorna o conteúdo de uma seção específica' })
  @ApiParam({ name: 'secao', description: "Slug da seção (ex: 'missao', 'historia', 'apoiadores')" })
  @ApiResponse({ status: 200, description: 'Seção retornada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Seção não encontrada.' })
  getSecao(@Param('secao') secao: string) {
    return this.service.getSecao(secao);
  }

  // ── Rotas PROTEGIDAS (somente admin/comunicacao) ─────────
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @Patch()
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }), new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Atualiza configurações gerais do site' })
  @ApiResponse({ status: 200, description: 'Configurações atualizadas com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão (requer ADMIN ou COMUNICACAO).' })
  async updateAll(@Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
    const result = await this.service.updateMany(body, getAuditUser(req));
    // Invalida cache das rotas públicas para que o frontend receba dados atualizados imediatamente
    await Promise.all([
      this.cacheManager.del(CACHE_KEYS.all),
      this.cacheManager.del(CACHE_KEYS.secoes),
    ]);
    return result;
  }

  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @Patch('secoes/:secao')
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }), new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Atualiza o conteúdo de uma seção' })
  @ApiParam({ name: 'secao', description: "Slug da seção a atualizar (ex: 'missao', 'historia')" })
  @ApiResponse({ status: 200, description: 'Seção atualizada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token ausente ou expirado.' })
  @ApiResponse({ status: 403, description: 'Role sem permissão.' })
  @ApiResponse({ status: 404, description: 'Seção não encontrada.' })
  async updateSecao(@Param('secao') secao: string, @Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
    const result = await this.service.updateSecao(secao, body, getAuditUser(req));
    // Invalida a listagem geral de seções. A rota de seção específica não usa cache para evitar conteúdo antigo.
    await this.cacheManager.del(CACHE_KEYS.secoes);
    return result;
  }
}
