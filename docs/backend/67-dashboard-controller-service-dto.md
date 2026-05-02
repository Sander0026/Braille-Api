# 67 — Dashboard: Controller, Service e DTO

---

# 1. Visão Geral

Este documento detalha os três arquivos centrais do módulo `Dashboard`:

```txt
src/dashboard/dashboard.controller.ts
src/dashboard/dashboard.service.ts
src/dashboard/dto/estatisticas-response.dto.ts
```

O objetivo do módulo é fornecer uma resposta simples e performática para os cards principais da tela inicial do sistema.

Responsabilidades principais:

- expor endpoint de estatísticas gerais;
- proteger o endpoint com autenticação e roles;
- aplicar cache de resposta;
- executar contagens agregadas no banco;
- montar DTO de resposta;
- ocultar falhas internas do banco;
- documentar retorno via Swagger.

---

# 2. DashboardController

## Base route

```txt
/dashboard
```

## Decorators de classe

```txt
@ApiTags('Dashboard (Painel Inicial)')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SECRETARIA, Role.COMUNICACAO, Role.PROFESSOR)
@Controller('dashboard')
```

## Impacto arquitetural

Esses decorators definem que:

- o endpoint pertence ao grupo Swagger `Dashboard (Painel Inicial)`;
- a rota exige autenticação Bearer/JWT;
- a rota exige autorização por perfil;
- apenas usuários internos acessam os dados agregados;
- o controller expõe rotas sob `/dashboard`.

---

# 3. Endpoint de Estatísticas

## Rota

```txt
GET /dashboard/estatisticas
```

## Método

```txt
getEstatisticas(): Promise<EstatisticasResponseDto>
```

## Responsabilidade

Retornar números gerais para montar os cards da tela inicial.

## Perfis permitidos

```txt
ADMIN
SECRETARIA
COMUNICACAO
PROFESSOR
```

## Fluxo

1. usuário autenticado chama `/dashboard/estatisticas`;
2. `AuthGuard` valida autenticação;
3. `RolesGuard` valida role interna;
4. `CacheInterceptor` verifica cache pela chave `estatisticas_home`;
5. se não houver cache, chama `DashboardService.getEstatisticas()`;
6. service calcula contagens;
7. controller retorna DTO.

---

# 4. Cache do Endpoint

Configuração:

```txt
@UseInterceptors(CacheInterceptor)
@CacheKey('estatisticas_home')
@CacheTTL(300_000)
```

## Objetivo

O cache evita que múltiplos acessos ao dashboard disparem repetidamente as mesmas contagens no banco.

## Benefícios

- reduz carga no banco;
- melhora tempo de resposta;
- evita repetição de queries em telas muito acessadas;
- torna o dashboard mais leve para uso diário.

## Ponto de atenção

A unidade de `CacheTTL` depende da versão/configuração do `@nestjs/cache-manager` e `cache-manager`.

O comentário do código indica intenção de 5 minutos.

---

# 5. DashboardService

## Método principal

```txt
getEstatisticas(): Promise<EstatisticasResponseDto>
```

## Responsabilidade

Executar as agregações no banco e retornar o DTO da tela inicial.

## Dependência

| Dependência | Uso |
|---|---|
| `PrismaService` | Executar contagens nas tabelas principais |

---

# 6. Estratégia de Performance

O service executa as contagens simultaneamente com:

```txt
Promise.all([
  prisma.aluno.count(...),
  prisma.turma.count(...),
  prisma.user.count(...),
  prisma.comunicado.count(),
])
```

## Por que usar `Promise.all()`

As contagens são independentes entre si.

Executá-las em paralelo reduz o tempo total de resposta em comparação com executar uma por vez.

Exemplo conceitual:

```txt
Sequencial: tempo = soma das quatro consultas
Paralelo: tempo ≈ consulta mais lenta
```

---

# 7. Indicadores Calculados

| Campo do DTO | Consulta | Filtro | Significado |
|---|---|---|---|
| `alunosAtivos` | `prisma.aluno.count()` | `statusAtivo = true` | Total de alunos ativos |
| `turmasAtivas` | `prisma.turma.count()` | `statusAtivo = true` | Total de turmas ativas |
| `membrosEquipe` | `prisma.user.count()` | `statusAtivo = true` | Total de usuários internos ativos |
| `comunicadosGerais` | `prisma.comunicado.count()` | sem filtro | Total global de comunicados |

---

# 8. EstatisticasResponseDto

## Responsabilidade

Padronizar a resposta do endpoint de estatísticas.

## Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `alunosAtivos` | `number` | Número total de alunos cadastrados e ativos |
| `turmasAtivas` | `number` | Total de turmas ativas operacionais |
| `membrosEquipe` | `number` | Quantidade de usuários da equipe escolar |
| `comunicadosGerais` | `number` | Número global de comunicados cadastrados |

O DTO usa `@ApiProperty` em todos os campos, permitindo documentação clara no Swagger.

---

# 9. Tratamento de Erros

O service envolve as contagens em `try/catch`.

Em caso de erro:

1. registra log com contexto `DashboardService`;
2. lança:

```txt
InternalServerErrorException('Não foi possível obter as estatísticas do painel.')
```

## Justificativa

Essa abordagem impede vazamento de detalhes internos do banco, como mensagens de conexão, nomes de tabelas ou erros Prisma.

---

# 10. Segurança

## Controles existentes

- rota exige JWT;
- rota exige role interna;
- dados retornados são apenas agregados;
- não retorna listas de pessoas;
- não retorna dados pessoais;
- erros internos são mascarados.

## Perfis com acesso

| Perfil | Acesso |
|---|---|
| `ADMIN` | Sim |
| `SECRETARIA` | Sim |
| `COMUNICACAO` | Sim |
| `PROFESSOR` | Sim |
| usuários externos | Não |

---

# 11. Qualidade

Pontos positivos:

- controller extremamente simples;
- service coeso;
- DTO explícito;
- Swagger documentado;
- cache com chave própria;
- contagens paralelas;
- resposta pequena;
- regra sem acoplamento com frontend.

---

# 12. Performance

## Pontos positivos

- `Promise.all()` reduz latência;
- `count()` evita carregar registros;
- cache reduz consultas repetidas;
- payload de resposta é mínimo.

## Possíveis gargalos futuros

- contagens em tabelas muito grandes;
- ausência de índices adequados em `statusAtivo`;
- cache defasado após mutações relevantes;
- indicadores adicionais podem aumentar complexidade.

---

# 13. Pontos de Atenção

- `comunicadosGerais` conta todos os comunicados, sem filtrar ativos, publicados ou arquivados.
- O endpoint não diferencia dados por período.
- O endpoint não retorna comparativos mensais.
- Não existe invalidação explícita de cache após mutações.
- O logger é instanciado dinamicamente via `import('@nestjs/common')`, o que é incomum para service NestJS.
- O comentário indica 5 minutos de cache, mas a unidade de `CacheTTL` deve ser confirmada.

---

# 14. Melhorias Futuras

- Substituir logger dinâmico por propriedade privada:

```txt
private readonly logger = new Logger(DashboardService.name)
```

- Criar invalidação de cache após alterações em alunos, turmas, usuários e comunicados.
- Adicionar indicadores por período.
- Adicionar indicadores de frequência.
- Adicionar indicadores de certificados emitidos.
- Adicionar indicadores de matrículas ativas.
- Adicionar indicadores de atestados recentes.
- Diferenciar comunicados publicados de comunicados totais.
- Criar testes unitários para o service.
- Criar testes e2e de autorização por role.

---

# 15. Resumo Técnico Final

O conjunto `DashboardController`, `DashboardService` e `EstatisticasResponseDto` forma um módulo simples, performático e adequado para a tela inicial.

O endpoint usa autenticação, autorização, cache, contagens paralelas e resposta agregada sem dados sensíveis.

Criticidade: média/alta.

Complexidade: baixa.

A implementação é objetiva e eficiente. Os principais ajustes recomendados são padronizar logger, invalidar cache após mutações e expandir os indicadores conforme a evolução do painel.
