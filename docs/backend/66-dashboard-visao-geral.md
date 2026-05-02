# 66 — Dashboard: Visão Geral do Módulo (`src/dashboard/`)

---

# 1. Visão Geral

O módulo `Dashboard` é responsável por fornecer estatísticas gerais para a tela inicial/painel administrativo do sistema.

Arquivos principais:

```txt
src/dashboard/dashboard.module.ts
src/dashboard/dashboard.controller.ts
src/dashboard/dashboard.service.ts
src/dashboard/dto/estatisticas-response.dto.ts
```

Responsabilidades principais:

- expor endpoint de estatísticas gerais;
- proteger acesso ao painel para usuários internos;
- contar alunos ativos;
- contar turmas ativas;
- contar membros ativos da equipe;
- contar comunicados cadastrados;
- retornar DTO padronizado para cards do dashboard;
- usar cache para reduzir consultas repetidas;
- executar contagens em paralelo para melhorar performance;
- ocultar detalhes de erro do banco em caso de falha.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- NestJS Module Pattern;
- Controller-Service Pattern;
- Service Layer;
- Dashboard Aggregation Pattern;
- Parallel Query Pattern;
- Cache Pattern;
- DTO Response Pattern;
- RBAC;
- Data Leak Prevention Pattern.

## Justificativa Técnica

O dashboard concentra dados de diferentes domínios em um único payload otimizado para a tela inicial.

Como essas estatísticas são consultadas com frequência e não exigem atualização em tempo real absoluto, o uso de cache reduz carga no banco e melhora o tempo de resposta.

---

# 3. DashboardModule

Declara:

- `DashboardController`;
- `DashboardService`.

O módulo é simples e depende diretamente do `PrismaService` injetado no service pelo mecanismo global/configurado da aplicação.

---

# 4. DashboardController

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

## Endpoint

```txt
GET /dashboard/estatisticas
```

Responsabilidade:

```txt
Obter números gerais do sistema para montar os cards da tela inicial.
```

Perfis permitidos:

- `ADMIN`;
- `SECRETARIA`;
- `COMUNICACAO`;
- `PROFESSOR`.

---

# 5. Cache

O endpoint usa:

```txt
@UseInterceptors(CacheInterceptor)
@CacheKey('estatisticas_home')
@CacheTTL(300_000)
```

Objetivo:

- reduzir consultas repetidas;
- evitar contagens frequentes no banco;
- melhorar tempo de carregamento do painel inicial.

Ponto de atenção:

```txt
A unidade efetiva de CacheTTL depende da versão/configuração do cache-manager/NestJS.
```

---

# 6. DashboardService

## Método principal

```txt
getEstatisticas(): Promise<EstatisticasResponseDto>
```

## Fluxo

1. executa quatro contagens em paralelo com `Promise.all()`;
2. cria uma instância de `EstatisticasResponseDto`;
3. preenche os campos do DTO;
4. retorna estatísticas para o controller;
5. em caso de erro, registra log e lança erro genérico.

---

# 7. Consultas Realizadas

O service executa:

| Indicador | Consulta Prisma | Filtro |
|---|---|---|
| `alunosAtivos` | `prisma.aluno.count()` | `statusAtivo = true` |
| `turmasAtivas` | `prisma.turma.count()` | `statusAtivo = true` |
| `membrosEquipe` | `prisma.user.count()` | `statusAtivo = true` |
| `comunicadosGerais` | `prisma.comunicado.count()` | sem filtro |

---

# 8. DTO de Resposta

## `EstatisticasResponseDto`

Campos:

| Campo | Tipo | Objetivo |
|---|---|---|
| `alunosAtivos` | `number` | Número total de alunos ativos |
| `turmasAtivas` | `number` | Número total de turmas ativas |
| `membrosEquipe` | `number` | Número total de usuários ativos da equipe |
| `comunicadosGerais` | `number` | Número total de comunicados cadastrados |

O DTO é documentado com `@ApiProperty`, melhorando o contrato Swagger.

---

# 9. Tratamento de Erros

Se alguma contagem falhar, o service:

1. registra erro com `Logger('DashboardService')`;
2. lança:

```txt
InternalServerErrorException('Não foi possível obter as estatísticas do painel.')
```

Essa abordagem evita expor erro cru do banco para o cliente.

---

# 10. Segurança e Qualidade

## Segurança

Pontos fortes:

- endpoint exige JWT;
- endpoint exige perfil interno;
- não expõe dados pessoais;
- retorna apenas agregações numéricas;
- oculta erro interno do banco.

## Qualidade

Pontos positivos:

- controller fino;
- service coeso;
- DTO explícito;
- Swagger documentado;
- cache com chave específica;
- contagens paralelas com `Promise.all()`.

## Performance

- cache reduz carga em chamadas repetidas;
- contagens são executadas em paralelo;
- resposta contém apenas números;
- consulta não carrega registros completos.

---

# 11. Pontos de Atenção

- `comunicadosGerais` conta todos os comunicados, inclusive arquivados/inativos se existirem regras futuras.
- Não há filtro por período.
- Não há métricas históricas ou comparativas.
- Cache pode ficar defasado após criação/alteração de alunos, turmas, usuários ou comunicados.
- O uso dinâmico de `import('@nestjs/common')` para Logger é incomum e poderia ser substituído por logger de classe.

---

# 12. Melhorias Futuras

- Criar invalidação de cache após mutações relevantes;
- adicionar indicadores por período;
- adicionar cards de frequência, matrículas, certificados e atestados;
- diferenciar comunicados ativos/publicados de total global;
- usar `Logger` como propriedade privada da classe;
- criar testes unitários para agregações;
- criar testes e2e de autorização por role.

---

# 13. Resumo Técnico Final

O módulo `Dashboard` é pequeno, mas importante para a experiência inicial do sistema.

Ele entrega estatísticas agregadas com segurança, cache e performance adequada para cards administrativos.

Criticidade: média/alta.

Complexidade: baixa/média.

A implementação é objetiva e eficiente. Os principais pontos de evolução são ampliar indicadores, invalidar cache após mutações e padronizar o logger do service.
