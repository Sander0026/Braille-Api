# 17 — Segurança Global da API

---

# 1. Visão Geral

Este documento registra os mecanismos globais de segurança aplicados na Braille API.

Principais camadas:

- Helmet;
- CORS;
- ValidationPipe global;
- ThrottlerGuard global;
- limite de payload;
- JWT e RBAC;
- validação de ambiente;
- filtros globais Prisma;
- sanitização HTML em rotas específicas;
- auditoria global/manual.

---

# 2. Camadas de Segurança

## Helmet

Configurado no `main.ts`.

Objetivo:

- aplicar headers HTTP seguros;
- reduzir exposição de informações da stack;
- mitigar ataques comuns em browsers.

## CORS

Configurado no `main.ts`.

Origens permitidas:

- `http://localhost:4200`;
- frontend publicado em Vercel;
- `FRONTEND_URL` via ambiente.

A configuração usa `credentials: true`, então as origens devem continuar restritas.

## ValidationPipe Global

Configuração principal:

```txt
whitelist: true
forbidNonWhitelisted: true
transform: true
```

Impacto:

- rejeita campos extras;
- transforma tipos conforme DTO;
- reduz risco de mass assignment;
- obriga contratos explícitos.

## ThrottlerGuard Global

Registrado no `AppModule` via `APP_GUARD`.

Objetivo:

- reduzir abuso de requisições;
- mitigar força bruta simples;
- proteger endpoints públicos como contato, login e refresh.

Variáveis relacionadas:

- `THROTTLER_TTL`;
- `THROTTLER_LIMIT`.

## Limite de Payload

Configurado no `main.ts`:

- JSON até `20mb`;
- URL encoded até `20mb`.

Uploads têm limites próprios em interceptors, como 5 MB para planilhas e 10 MB para arquivos Cloudinary.

---

# 3. Autenticação e Autorização

## JWT

O access token é assinado pelo `JwtService`, com secret configurado pelo `JwtModule`.

O `AuthGuard` valida:

- token Bearer;
- assinatura;
- expiração;
- usuário existente;
- usuário ativo;
- usuário não excluído.

## RBAC

O `RolesGuard` usa `@Roles()` para validar autorização por perfil.

Perfis:

- `ADMIN`;
- `SECRETARIA`;
- `PROFESSOR`;
- `COMUNICACAO`.

## Refresh Token

A API usa refresh token opaco por sessão.

Características:

- formato `sessionId.secret`;
- hash salvo em `UserSession`;
- rotação a cada uso;
- hash anterior para detectar reuso real;
- revogação por sessão.

---

# 4. Validação de Ambiente

O arquivo `env.validation.ts` impede startup inseguro.

Valida:

- `DATABASE_URL`;
- `DIRECT_URL`;
- `JWT_SECRET`;
- Cloudinary;
- `FRONTEND_URL` em produção;
- `SENHA_PADRAO_USUARIO` em produção;
- porta;
- cache;
- throttling;
- força mínima do `JWT_SECRET` em produção.

---

# 5. Sanitização e Uploads

## Sanitização HTML

Rotas de conteúdo como comunicados e CMS usam `SanitizeHtmlPipe`.

Objetivo:

- reduzir risco de HTML malicioso;
- preservar conteúdo permitido;
- proteger renderização no frontend.

## Uploads

Controles aplicados:

- validação de mimetype;
- limite de tamanho;
- uso de memory storage;
- restrição de pastas no service;
- exclusão controlada no Cloudinary.

Exemplos:

- `.xlsx` para importação de alunos;
- imagens/PDF para conteúdo;
- documentos LGPD, atestado e laudo restritos a perfis administrativos.

---

# 6. Tratamento de Erros

Filtros globais Prisma:

- `PrismaExceptionFilter`;
- `PrismaValidationFilter`.

Objetivo:

- traduzir erros Prisma;
- evitar exposição de detalhes internos;
- padronizar respostas HTTP;
- melhorar diagnóstico sem vazar dados sensíveis.

---

# 7. Auditoria

A API usa auditoria global/manual.

Componentes relacionados:

- `AuditInterceptor`;
- `SkipAudit`;
- `getAuditUser(req)`;
- `AuditLogService`.

Módulos sensíveis usam auditoria manual para registrar usuário, IP/user agent e alterações relevantes.

---

# 8. Pontos de Atenção

- O Swagger em `/docs` deve ser avaliado em produção.
- `req.ip` pode depender de reverse proxy.
- Limite global de 20 MB é alto para rotas que não precisam disso.
- `ThrottlerGuard` global pode precisar de regras específicas para login/refresh.
- Upload em memória exige controle rigoroso de tamanho.
- Campos legados de refresh token em `User` ainda devem ser removidos futuramente.

---

# 9. Melhorias Futuras

- Proteger ou desabilitar Swagger em produção.
- Configurar trust proxy e helper de IP.
- Criar rate limit específico para `/auth/login`.
- Reduzir limite global de payload e aplicar exceções por rota.
- Adicionar logs estruturados com correlation ID.
- Criar testes e2e de autorização e segurança.
- Criar job de limpeza de sessões expiradas.

---

# 10. Resumo Técnico Final

A segurança global da Braille API está bem estruturada em múltiplas camadas: headers HTTP, CORS restrito, validação global, rate limit, JWT, RBAC, refresh token rotativo, validação de ambiente, sanitização, filtros Prisma e auditoria.

Criticidade: muito alta.

Complexidade: alta.

A implementação é profissional. Os principais próximos passos são endurecer Swagger em produção, criar rate limit específico para autenticação, padronizar IP em proxy e ampliar testes de segurança.
