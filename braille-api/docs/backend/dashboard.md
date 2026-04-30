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

# 8. Pontos de Atencao Tratados

* O DTO de resposta `EstatisticasResponseDto` está perfeitamente documentado usando decorators do Swagger (`@ApiProperty`), provendo não apenas a tipagem, mas descrições semânticas ricas e dados de exemplo. Nenhuma propriedade ficou obscura ou mal nomeada.
* O design para crescimento no Service foi selado com alta performance: a leitura ocorre em lote estrito via `Promise.all` utilizando exclusivamente funções `count()`, evitando tráfego de grandes entidades (`findMany`) e reduzindo a latência da aba do dashboard a valores próximos de zero.
* Em adição às regras, o bloco `catch` do Service oculta inteligentemente qualquer estouro de exceção do BD por trás de um `InternalServerErrorException`, aderindo ao princípio de **Data Leak Prevention** (DLP) contra exposição da string de conexão.

---

# 9. Relacao com Outros Modulos

* Le dados de alunos, turmas, usuarios e possivelmente contatos/comunicados.
* Depende de `Auth` para controle de acesso.

---

Dashboard é um módulo de leitura agregada com criticidade moderada. O fluxo está maduro: adota a mecânica de Read Model rápido via execuções concorrentes (`Promise.all()`) sobre agregações em banco (apenas `count()`). Isso garante que, por mais que a base de dados do instituto escale, o endpoint de Home Page interna não causará engarrafamentos na fila de IO. Ele expõe a clareza e as regras limpas exigidas no contrato SOLID.

