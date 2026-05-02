import { Controller, Get, Patch, Body, UseGuards, Param, UsePipes, ValidationPipe, Req, Inject, UseInterceptors } from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SiteConfigService } from './site-config.service';
import { SanitizeHtmlPipe } from '../common/pipes/sanitize-html.pipe';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @CacheTTL(600_000) // 10 minutos
  @ApiOperation({ summary: 'Retorna todas as configurações do site (cor, logo…)' })
  getAll() {
    return this.service.getAll();
  }

  @Get('secoes')
  @UseInterceptors(CacheInterceptor)
  @CacheKey(CACHE_KEYS.secoes)
  @CacheTTL(600_000) // 10 minutos
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
  async updateAll(@Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
    const result = await this.service.updateMany(body, getAuditUser(req));
    // Invalida cache das rotas públicas para que o frontend receba dados atualizados imediatamente
    await Promise.all([
      this.cacheManager.del(CACHE_KEYS.all),
      this.cacheManager.del(CACHE_KEYS.secoes),
    ]);
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COMUNICACAO)
  @Patch('secoes/:secao')
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }), new SanitizeHtmlPipe())
  @ApiOperation({ summary: 'Atualiza o conteúdo de uma seção' })
  async updateSecao(@Param('secao') secao: string, @Body() body: Record<string, string>, @Req() req: AuthenticatedRequest) {
    const result = await this.service.updateSecao(secao, body, getAuditUser(req));
    // Invalida a listagem geral de seções. A rota de seção específica não usa cache para evitar conteúdo antigo.
    await this.cacheManager.del(CACHE_KEYS.secoes);
    return result;
  }
}
