# Documentacao Tecnica Backend - Braille API

---

# 1. Visao Geral

## Objetivo

Este indice consolida a varredura tecnica do backend `braille-api`, uma API NestJS em TypeScript voltada a gestao institucional do Instituto Luiz Braille. A documentacao foi organizada por dominio funcional, mantendo rastreabilidade entre controllers, services, DTOs, entidades Prisma, integracoes, seguranca e fluxos de dados.

## Responsabilidade

O indice atua como mapa oficial da documentacao backend. Ele aponta os modulos documentados, explica a arquitetura geral e registra como cada dominio se comunica com os demais.

## Fluxo de Funcionamento

O backend inicializa em `src/main.ts`, carrega `AppModule`, aplica prefixo global `/api`, habilita CORS, Helmet, compressao, validacao global por DTO, Swagger, cache global, rate limit global, scheduler, filtro global de erros Prisma e interceptor global de auditoria. Os controllers recebem requisicoes HTTP, validam DTOs, aplicam guards de autenticacao/autorizacao e delegam regras de negocio para services. Os services usam `PrismaService` para persistencia em PostgreSQL e integram Cloudinary, PDF, QR Code, cache e auditoria.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* NestJS modular.
* MVC aplicado por controllers, services e modules.
* Service Layer.
* Repository Pattern indireto via Prisma Client.
* Dependency Injection por IoC do NestJS.
* DTO Pattern com `class-validator` e `class-transformer`.
* Guard Pattern para JWT e roles.
* Interceptor Pattern para auditoria global.
* Filter Pattern para excecoes Prisma.
* Soft Delete em entidades operacionais.
* Transaction Script em fluxos atomicos com `prisma.$transaction`.
* Scheduled Jobs em `TurmasScheduler`.
* Cache-aside em rotas publicas/listagens com `CacheInterceptor`.

## Justificativa Tecnica

A arquitetura modular do NestJS separa dominios por responsabilidade, reduz acoplamento e facilita manutencao. O Prisma centraliza persistencia tipada e evita SQL manual na maior parte do sistema. A validacao global com whitelist remove campos extras antes de chegar aos services, reduzindo risco de mass assignment. Guards e decorators de roles mantem autorizacao declarativa no nivel HTTP. A auditoria fire-and-forget preserva rastreabilidade sem bloquear fluxos principais.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Entrada HTTP chega em `/api/*`.
2. `ValidationPipe` valida e transforma DTOs.
3. `ThrottlerGuard` aplica rate limit global.
4. Controllers aplicam `AuthGuard` e `RolesGuard` quando necessario.
5. Controllers extraem usuario via `getAuditUser` quando a operacao precisa de auditoria.
6. Services executam regras de negocio e persistencia via Prisma.
7. Integracoes externas sao chamadas em services dedicados: Cloudinary em `UploadService`, PDF em `PdfService`.
8. Excecoes Prisma sao normalizadas pelos filtros globais.
9. Respostas retornam entidades, metadados de paginacao ou `ApiResponse`.
10. Auditoria e limpezas de arquivo usam fire-and-forget ou soft fail quando nao devem bloquear a resposta.

## Dependencias Internas

* `src/app.module.ts`
* `src/main.ts`
* `src/prisma/prisma.service.ts`
* `src/auth/*`
* `src/common/*`
* `src/users/*`
* `src/beneficiaries/*`
* `src/turmas/*`
* `src/frequencias/*`
* `src/atestados/*`
* `src/laudos/*`
* `src/certificados/*`
* `src/apoiadores/*`
* `src/comunicados/*`
* `src/contatos/*`
* `src/site-config/*`
* `src/upload/*`
* `src/dashboard/*`

## Dependencias Externas

* `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
* `@nestjs/jwt`, `@nestjs/config`, `@nestjs/swagger`
* `@nestjs/cache-manager`, `@nestjs/throttler`, `@nestjs/schedule`
* `@prisma/client`, `prisma`
* `bcrypt`
* `cloudinary`, `streamifier`
* `pdf-lib`, `@pdf-lib/fontkit`, `qrcode`
* `jimp`
* `exceljs`
* `helmet`, `compression`
* `dompurify`, `jsdom`
* `class-validator`, `class-transformer`

---

# 4. Dicionario Tecnico

## Variaveis

* `DATABASE_URL`: conexao Prisma/PostgreSQL.
* `DIRECT_URL`: conexao direta usada pelo Prisma quando configurada.
* `JWT_SECRET`: segredo de assinatura e verificacao dos JWTs.
* `PORT`: porta HTTP, padrao `3000`.
* `CACHE_TTL`: TTL global de cache, padrao `300000`.
* `THROTTLER_TTL`: janela de rate limit, padrao `60000`.
* `THROTTLER_LIMIT`: limite de requisicoes por janela, padrao `30`.
* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: credenciais Cloudinary.
* `FRONTEND_URL`: base usada no QR Code de validacao de certificados.
* `SENHA_PADRAO_USUARIO`: senha inicial de usuarios internos.
* `FREQUENCIAS_PERMITIR_RETROATIVAS`: permite chamadas retroativas para nao administradores durante implantacao; padrao `true`.

## Funcoes e Metodos

Os metodos especificos estao documentados por dominio nos arquivos vinculados abaixo.

## Classes

As classes principais sao controllers, services, modules, DTOs, guards, filters, interceptors e helpers. Cada arquivo de modulo documenta as classes relacionadas.

## Interfaces e Tipagens

* `AuthenticatedRequest`: request Express enriquecida com `user`.
* `AuthenticatedUser`: payload JWT padronizado.
* `AuditUser`: contexto de auditoria.
* `AuditOptions`: contrato de registro de auditoria.
* DTOs de entrada por dominio.
* Modelos Prisma definidos em `prisma/schema.prisma`.

---

# 5. Servicos e Integracoes

## APIs

Os endpoints estao descritos nos documentos de cada dominio:

* [core.md](core.md)
* [auth.md](auth.md)
* [users.md](users.md)
* [beneficiaries.md](beneficiaries.md)
* [turmas.md](turmas.md)
* [frequencias.md](frequencias.md)
* [atestados-laudos.md](atestados-laudos.md)
* [certificados.md](certificados.md)
* [apoiadores.md](apoiadores.md)
* [comunicados-contatos-site.md](comunicados-contatos-site.md)
* [upload.md](upload.md)
* [audit-log.md](audit-log.md)
* [common.md](common.md)
* [database-prisma.md](database-prisma.md)
* [dashboard.md](dashboard.md)
* [seed-scripts.md](seed-scripts.md)
* [HISTORY.md](HISTORY.md)

## Banco de Dados

O banco e PostgreSQL via Prisma. As entidades principais sao `User`, `Aluno`, `Turma`, `MatriculaOficina`, `GradeHoraria`, `Frequencia`, `Atestado`, `LaudoMedico`, `Comunicado`, `MensagemContato`, `SiteConfig`, `ConteudoSecao`, `AuditLog`, `Apoiador`, `AcaoApoiador`, `ModeloCertificado` e `CertificadoEmitido`.

## Servicos Externos

* Cloudinary: armazenamento de imagens, PDFs, laudos, termos, atestados, logos e certificados.
* Google Fonts via GitHub raw allowlist: fontes usadas pelo motor de PDF.
* Frontend publico: link de validacao via QR Code.
* Neon/PostgreSQL: banco relacional serverless, com keep-alive no Prisma.

---

# 6. Seguranca e Qualidade

## Seguranca

* JWT com access token curto.
* Refresh token gerado aleatoriamente, armazenado com hash bcrypt em `UserSession` e rotacionado por sessao.
* Anti timing attack no login com dummy hash.
* `AuthGuard` valida assinatura e status real do usuario no banco.
* `RolesGuard` valida autorizacao declarativa via `@Roles`.
* `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`.
* Sanitizacao HTML com DOMPurify em modulos que aceitam conteudo rico.
* Helmet para headers HTTP.
* Throttler global contra abuso.
* Filtros Prisma evitam vazamento de schema/SQL.
* Auditoria remove campos sensiveis e trunca payloads grandes.
* Allowlist de hosts no PDF e redirect de certificado para prevenir SSRF.

## Qualidade

* Testes unitarios existem em varios dominios, mas a cobertura nao foi recalculada nesta varredura.
* Logs NestJS em services criticos.
* Selects Prisma cirurgicos reduzem trafego de dados sensiveis.
* Transacoes protegem importacao, frequencia em lote, atestados e alteracoes de turma.

## Performance

* Cache em listagens e endpoints publicos.
* Compressao HTTP.
* Upload em memoria com streaming para Cloudinary.
* Exportacao Excel com `WorkbookWriter` em streaming.
* `Promise.all` para consultas paralelas e contagens.
* Keep-alive Prisma para reduzir cold reconnect do Neon.
* Cache de fontes no `PdfService`.

---

# 7. Regras de Negocio

* Usuarios internos possuem roles `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO`.
* Alunos possuem matricula institucional anual unica.
* Staff possui matricula com prefixo `P`.
* Aluno nao pode ter CPF/RG duplicado ativo.
* Usuario nao pode ter CPF duplicado ativo.
* Turmas possuem ciclo `PREVISTA`, `ANDAMENTO`, `CONCLUIDA`, `CANCELADA`.
* Matricula ativa em turma e bloqueada quando ja existe vinculo ativo.
* Turmas validam capacidade maxima.
* Professor e aluno nao podem ter choque de horario.
* Diario fechado bloqueia edicoes para nao administradores.
* Atestado justifica faltas automaticamente no periodo.
* Certificado academico exige turma/matricula concluida, modelo vinculado e frequencia minima quando ha registros.
* Certificado publico e validado por codigo.
* Conteudo do site e versionado logicamente via auditoria.
* Apoiadores podem receber certificados por acoes/eventos.

---

# 8. Pontos de Atencao

* A pasta inesperada `src/users/dto/rc/users/dto/query-user.dto.ts` foi removida.
* Alguns comentarios e strings do codigo aparecem com encoding corrompido no terminal, embora a intencao funcional esteja clara.
* `FrequenciasService.validarDataHoje` agora aplica a regra quando `FREQUENCIAS_PERMITIR_RETROATIVAS=false`; o padrao `true` preserva a implantacao atual.
* `CertificadosService.remove` foi simplificado para delecao direta dos arquivos externos, sem caminho redundante por `trocarArquivo`.
* Auditoria ganhou `@SkipAudit()` e helpers de mapeamento para reduzir manutencao manual de paths excluidos.
* Cache publico de comunicados usa URL completa como chave e `site-config/secoes/:secao` nao usa cache para evitar conteudo antigo.
* `GET /users` ficou restrito a `ADMIN` e `SECRETARIA`; demais perfis usam `GET /users/resumo` com dados minimos.
* `UploadService.deleteFile` valida allowlist de pastas Cloudinary antes de excluir arquivos remotos.
* Refresh token sem `userId` no payload foi alinhado ao modelo `UserSession`, com logout por sessao atual e testes atualizados.
* Alguns endpoints ainda retornam entidade Prisma crua, outros retornam `ApiResponse`; o contrato HTTP nao e totalmente uniforme e continua como ponto de padronizacao futura.

---

# 9. Relacao com Outros Modulos

* `Auth` protege praticamente todos os dominios internos.
* `Prisma` e dependencia estrutural de todos os services persistentes.
* `AuditLog` e dependencia transversal.
* `Upload` serve alunos, usuarios, laudos, atestados, comunicados, apoiadores e certificados.
* `Certificados` depende de alunos, turmas, frequencias, upload e PDF.
* `Turmas` depende de usuarios e alunos.
* `Frequencias` depende de turmas, alunos e atestados.
* `SiteConfig`, `Comunicados` e `Contatos` conectam CMS publico e painel administrativo.

---

# 10. Resumo Tecnico Final

O backend apresenta uma arquitetura NestJS modular, orientada a services e Prisma, com foco claro em gestao institucional, controle academico, auditoria e geracao de documentos. A criticidade e alta porque manipula dados pessoais, documentos medicos, credenciais, certificados e historico academico. A complexidade e media-alta por combinar regras academicas, arquivos externos, transacoes, PDF dinamico e autorizacao por perfil. Os principais riscos atuais estao na consistencia de contratos HTTP, manutencao da auditoria duplicada/manual e pontos de regra comentada mas relaxada.
