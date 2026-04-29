# Modulo: Dashboard

---

# 1. Visao Geral

## Objetivo

Documentar `src/dashboard`, modulo de estatisticas resumidas para o painel interno.

## Responsabilidade

Fornecer indicadores agregados de alunos, turmas, usuarios e dados operacionais para usuarios internos autorizados.

## Fluxo de Funcionamento

Controller protegido por `AuthGuard`, `RolesGuard` e roles internas chama `DashboardService.getEstatisticas()`. A resposta e cacheada por `CacheInterceptor`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Query Service.
* Read Model simples.
* CacheInterceptor.
* Role-based Access Control.

## Justificativa Tecnica

Dashboard e leitura agregada, sem mutacao. Manter em service isolado simplifica consultas e permite otimizar agregacoes sem impactar dominios transacionais.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `GET /api/dashboard/estatisticas` exige usuario interno.
2. Controller aplica cache.
3. Service consulta Prisma para montar estatisticas.
4. Retorna DTO `EstatisticasResponseDto`.
5. Em erro, service usa tratamento NestJS e logging dinamico.

## Dependencias Internas

* `PrismaService`
* `AuthGuard`, `RolesGuard`, `Roles`
* `EstatisticasResponseDto`

## Dependencias Externas

* `@nestjs/cache-manager`
* `@prisma/client`

---

# 4. Dicionario Tecnico

## Variaveis

* `totalAlunos`: quantidade de alunos.
* `totalTurmas`: quantidade de turmas.
* `totalUsuarios`: quantidade de usuarios.
* Indicadores adicionais dependem do DTO e consultas implementadas.

## Funcoes e Metodos

* `getEstatisticas()`: agrega dados para dashboard.

## Classes

* `DashboardController`
* `DashboardService`
* `DashboardModule`
* `EstatisticasResponseDto`

## Interfaces e Tipagens

DTO de resposta de estatisticas.

---

# 5. Servicos e Integracoes

## APIs

* `GET /api/dashboard/estatisticas`

## Banco de Dados

Consulta tabelas operacionais via Prisma.

## Servicos Externos

Nao ha integracao externa.

---

# 6. Seguranca e Qualidade

## Seguranca

* Acesso limitado a `ADMIN`, `SECRETARIA`, `COMUNICACAO` e `PROFESSOR`.
* Sem dados sensiveis detalhados; retorna agregados.

## Qualidade

* Controller fino.
* Cache reduz carga.

## Performance

* Endpoint cacheado.
* Consultas agregadas evitam trafegar entidades completas.

---

# 7. Regras de Negocio

* Dashboard e apenas para usuarios internos.
* Estatisticas devem refletir registros relevantes para operacao administrativa.

---

# 8. Pontos de Atencao

* O service e pequeno; qualquer crescimento deve manter consultas agregadas eficientes.
* Recomenda-se documentar no DTO exatamente cada indicador retornado.

---

# 9. Relacao com Outros Modulos

* Le dados de alunos, turmas, usuarios e possivelmente contatos/comunicados.
* Depende de `Auth` para controle de acesso.

---

# 10. Resumo Tecnico Final

Dashboard e modulo de leitura com criticidade media. A complexidade atual e baixa, mas pode crescer conforme novos indicadores. O ponto principal e manter cache e agregacoes eficientes.

