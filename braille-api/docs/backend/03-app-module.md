# 03 — AppModule (`src/app.module.ts`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o `AppModule`, módulo raiz da Braille API.

O `AppModule` é responsável por compor a aplicação NestJS, importar módulos funcionais, configurar módulos globais e registrar providers transversais como guard global de rate limit, interceptor global de auditoria e filtros globais de exceções Prisma.

## Responsabilidade

O `AppModule` possui responsabilidade de composição arquitetural.

Ele não implementa regra de negócio diretamente. Sua função é organizar a aplicação e conectar os módulos de infraestrutura, segurança, domínio e observabilidade.

Responsabilidades principais:

- carregar variáveis de ambiente via `ConfigModule`;
- validar o ambiente com `validateEnv`;
- configurar cache global com `CacheModule`;
- configurar rate limit global com `ThrottlerModule`;
- registrar `PrismaModule`;
- habilitar agendamentos com `ScheduleModule`;
- importar todos os módulos funcionais;
- registrar `ThrottlerGuard` como guard global;
- registrar `AuditInterceptor` como interceptor global;
- registrar filtros globais para exceções Prisma.

## Fluxo de Funcionamento

Fluxo macro do `AppModule`:

```txt
AppModule
  ↓
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })
  ↓
CacheModule.registerAsync(...)
  ↓
ThrottlerModule.forRootAsync(...)
  ↓
PrismaModule + ScheduleModule
  ↓
Módulos de domínio: Auth, Users, Beneficiaries, Turmas, Frequencias, etc.
  ↓
Providers globais:
  - APP_GUARD: ThrottlerGuard
  - APP_INTERCEPTOR: AuditInterceptor
  - APP_FILTER: PrismaExceptionFilter
  - APP_FILTER: PrismaValidationFilter
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Root Module Pattern**: o `AppModule` atua como módulo raiz da aplicação.
- **Dependency Injection**: providers globais e módulos são registrados no container IoC do NestJS.
- **Modular Architecture**: cada domínio é importado como módulo independente.
- **Global Provider Pattern**: guards, interceptors e filters são aplicados globalmente com tokens `APP_GUARD`, `APP_INTERCEPTOR` e `APP_FILTER`.
- **Configuration Pattern**: uso de `ConfigModule` e `ConfigService` para parametrização por ambiente.
- **Async Module Registration**: cache e throttler são configurados dinamicamente via factories assíncronas.
- **Cross-Cutting Concerns**: auditoria, filtros, cache e rate limiting ficam fora dos módulos de negócio.

## Justificativa Técnica

Centralizar a composição da aplicação no `AppModule` é a abordagem padrão do NestJS para manter a arquitetura previsível.

O uso de módulos separados permite que cada domínio tenha seu próprio ciclo de dependências, evitando que regras de negócio fiquem concentradas em um único arquivo.

A configuração global de cache, throttling, auditoria e filtros reduz duplicação e garante comportamento uniforme em todos os módulos.

Essa abordagem melhora:

- coesão;
- rastreabilidade;
- escalabilidade;
- segurança transversal;
- manutenção;
- testabilidade;
- padronização de erros e auditoria.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Importação de dependências NestJS

O arquivo importa recursos centrais do NestJS:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
```

Essas importações são responsáveis por declarar o módulo raiz, carregar configuração, cache, providers globais, rate limit e agendamento.

### 2. Importação dos módulos internos

O `AppModule` importa módulos de infraestrutura e domínio:

- `PrismaModule`;
- `AuthModule`;
- `UsersModule`;
- `BeneficiariesModule`;
- `ComunicadosModule`;
- `TurmasModule`;
- `DashboardModule`;
- `FrequenciasModule`;
- `ContatosModule`;
- `UploadModule`;
- `SiteConfigModule`;
- `AuditLogModule`;
- `AtestadosModule`;
- `LaudosModule`;
- `ApoiadoresModule`;
- `CertificadosModule`.

Essa lista define quais módulos estarão disponíveis em runtime.

### 3. ConfigModule global

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
})
```

Responsabilidade:

- carregar variáveis de ambiente;
- tornar `ConfigService` disponível globalmente;
- validar ambiente no startup.

Impacto:

- se variáveis críticas estiverem inválidas, a aplicação falha cedo;
- reduz erros tardios em produção;
- evita módulos subirem sem credenciais essenciais.

### 4. CacheModule global

```ts
CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    ttl: configService.get<number>('CACHE_TTL', 300000),
  }),
})
```

Responsabilidade:

- configurar cache global;
- usar `CACHE_TTL` do ambiente;
- aplicar valor padrão de `300000` milissegundos quando ausente.

Uso no sistema:

- controllers podem aplicar `CacheInterceptor`;
- rotas de leitura podem reduzir carga no banco;
- CMS e listagens públicas se beneficiam de cache seletivo.

### 5. ThrottlerModule global

```ts
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => [
    {
      ttl: configService.get<number>('THROTTLER_TTL', 60000),
      limit: configService.get<number>('THROTTLER_LIMIT', 30),
    },
  ],
})
```

Responsabilidade:

- configurar limite de requisições por janela de tempo;
- reduzir abuso de rede;
- mitigar força bruta e spam.

Valores padrão:

- `ttl`: `60000` ms;
- `limit`: `30` requisições.

### 6. PrismaModule

```ts
PrismaModule
```

Fornece `PrismaService` para acesso ao banco PostgreSQL.

É uma dependência central de praticamente todos os módulos de domínio.

### 7. ScheduleModule

```ts
ScheduleModule.forRoot()
```

Habilita decorators de agendamento do NestJS:

- `@Cron`;
- `@Interval`;
- `@Timeout`.

Mesmo que nem todos os módulos usem agendamento atualmente, a infraestrutura fica habilitada globalmente.

### 8. Módulos de domínio

Cada módulo de domínio encapsula controllers, services e DTOs de uma área funcional.

Exemplos:

- `AuthModule`: autenticação e sessão;
- `UsersModule`: usuários internos;
- `BeneficiariesModule`: alunos/beneficiários;
- `TurmasModule`: oficinas e matrículas;
- `FrequenciasModule`: chamadas e diários;
- `ComunicadosModule`: mural público;
- `UploadModule`: Cloudinary;
- `CertificadosModule`: modelos e emissão de certificados.

### 9. Controller raiz

```ts
controllers: [AppController]
```

O `AppController` representa o controller base da aplicação. Normalmente é usado para health check simples ou rota inicial.

### 10. Provider raiz

```ts
providers: [AppService, ...]
```

O `AppService` é o service base da aplicação.

### 11. Guard global de throttling

```ts
{
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
}
```

Aplica rate limit globalmente a todas as rotas.

Impacto:

- todos os endpoints recebem proteção contra excesso de requisições;
- reduz necessidade de repetir guard em cada controller.

### 12. Interceptor global de auditoria

```ts
{
  provide: APP_INTERCEPTOR,
  useClass: AuditInterceptor,
}
```

Registra ações críticas em mutações HTTP, exceto quando módulos usam mecanismos próprios ou decoradores como `@SkipAudit()`.

Impacto:

- melhora rastreabilidade;
- apoia conformidade e investigação de alterações;
- centraliza logging de ações sensíveis.

### 13. Filtros globais Prisma

```ts
{
  provide: APP_FILTER,
  useClass: PrismaExceptionFilter,
},
{
  provide: APP_FILTER,
  useClass: PrismaValidationFilter,
}
```

Responsabilidade:

- capturar erros conhecidos do Prisma;
- transformar erros técnicos em respostas HTTP compreensíveis;
- reduzir exposição de detalhes internos do banco.

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `CACHE_TTL` | variável de ambiente | TTL padrão do cache global | Número em ms | Afeta frescor e performance de rotas cacheadas |
| `THROTTLER_TTL` | variável de ambiente | Janela de tempo do rate limit | Número em ms | Define intervalo de contagem de requisições |
| `THROTTLER_LIMIT` | variável de ambiente | Limite de requisições por janela | Número inteiro | Controla bloqueio de abuso |

## Funções e Métodos

### `ConfigModule.forRoot()`

| Item | Descrição |
|---|---|
| Objetivo | Carregar e validar ambiente |
| Parâmetros | `isGlobal`, `validate` |
| Retorno | Módulo de configuração NestJS |
| Exceções | Pode falhar se `validateEnv` rejeitar variáveis |
| Dependências | `validateEnv` |

### `CacheModule.registerAsync()`

| Item | Descrição |
|---|---|
| Objetivo | Registrar cache global dinamicamente |
| Parâmetros | `isGlobal`, `imports`, `inject`, `useFactory` |
| Retorno | Módulo de cache configurado |
| Dependências | `ConfigService` |

### `ThrottlerModule.forRootAsync()`

| Item | Descrição |
|---|---|
| Objetivo | Registrar rate limit global dinâmico |
| Parâmetros | `imports`, `inject`, `useFactory` |
| Retorno | Módulo de throttling configurado |
| Dependências | `ConfigService` |

### `ScheduleModule.forRoot()`

| Item | Descrição |
|---|---|
| Objetivo | Habilitar tarefas agendadas |
| Parâmetros | Nenhum |
| Retorno | Módulo de agendamento |
| Dependências | `@nestjs/schedule` |

## Classes

| Classe | Tipo | Responsabilidade |
|---|---|---|
| `AppModule` | Módulo NestJS | Composição raiz da aplicação |
| `AppController` | Controller | Controller raiz/base |
| `AppService` | Service | Service raiz/base |
| `ThrottlerGuard` | Guard | Rate limit global |
| `AuditInterceptor` | Interceptor | Auditoria global de mutações |
| `PrismaExceptionFilter` | Filter | Tratamento de erros conhecidos Prisma |
| `PrismaValidationFilter` | Filter | Tratamento de erros de validação Prisma |

## Interfaces e Tipagens

O `AppModule` não declara interfaces próprias. Ele utiliza tipagens do NestJS e de módulos externos:

- `ConfigService`;
- tokens `APP_GUARD`, `APP_INTERCEPTOR`, `APP_FILTER`;
- módulos NestJS importados;
- classes internas registradas como providers.

---

# 5. Serviços e Integrações

## APIs

O `AppModule` não define endpoints diretamente, mas importa módulos que definem controllers e rotas.

Módulos de API importados:

| Módulo | Área de API |
|---|---|
| `AuthModule` | `/auth` |
| `UsersModule` | `/users` |
| `BeneficiariesModule` | alunos/beneficiários |
| `ComunicadosModule` | `/comunicados` |
| `TurmasModule` | `/turmas` |
| `FrequenciasModule` | `/frequencias` |
| `ContatosModule` | contatos públicos/internos |
| `UploadModule` | `/upload` |
| `SiteConfigModule` | `/site-config` |
| `AtestadosModule` | atestados e justificativas |
| `LaudosModule` | laudos médicos |
| `ApoiadoresModule` | apoiadores e ações |
| `CertificadosModule` | modelos e emissão de certificados |
| `DashboardModule` | indicadores administrativos |
| `AuditLogModule` | auditoria |

## Banco de Dados

O `AppModule` importa `PrismaModule`, que fornece acesso ao banco PostgreSQL via Prisma.

O `AppModule` também registra filtros que tratam erros relacionados ao Prisma, tornando o banco uma dependência transversal da aplicação.

## Serviços Externos

O `AppModule` não chama serviços externos diretamente. Ele importa módulos que usam integrações, como:

- Cloudinary no módulo de upload e certificados;
- PostgreSQL via Prisma;
- bibliotecas de PDF e QR Code no módulo de certificados;
- ExcelJS nos módulos de importação/exportação.

---

# 6. Segurança e Qualidade

## Segurança

### Configuração validada

O uso de `validateEnv` impede que a aplicação suba com variáveis críticas inválidas.

### Rate limit global

O `ThrottlerGuard` global reduz risco de abuso em todos os endpoints.

### Tratamento global de exceções

Filtros Prisma reduzem exposição de mensagens técnicas e padronizam respostas.

### Auditoria global

O `AuditInterceptor` contribui para rastreabilidade de ações críticas.

## Qualidade

O `AppModule` mantém separação clara entre módulos funcionais e preocupações transversais.

A configuração assíncrona com `ConfigService` evita hardcode de TTLs e limites operacionais.

## Performance

O `CacheModule` global viabiliza cache seletivo em controllers.

O `ThrottlerModule` protege a aplicação de carga abusiva simples.

O `ScheduleModule` permite futuras tarefas automatizadas sem alterar o bootstrap.

---

# 7. Regras de Negócio

Embora o `AppModule` seja infraestrutura, ele impõe regras operacionais importantes:

- a aplicação só deve iniciar se o ambiente for válido;
- cache possui TTL configurável;
- todas as rotas estão sujeitas a rate limit global;
- mutações podem ser auditadas globalmente;
- erros Prisma devem ser tratados por filtros dedicados;
- todos os módulos funcionais são carregados no mesmo runtime;
- agendamentos são habilitados globalmente.

Essas regras são arquiteturais e afetam todos os módulos de negócio.

---

# 8. Pontos de Atenção

## Riscos

- Como o `ThrottlerGuard` é global, endpoints legítimos de alto volume podem precisar de exceções ou ajustes específicos.
- O cache global em memória funciona bem para uma instância, mas pode gerar inconsistência se a API escalar horizontalmente sem cache distribuído.
- O `AuditInterceptor` global precisa ser coordenado com módulos que usam auditoria manual para evitar duplicidade ou ausência de logs.
- O `ScheduleModule` está habilitado globalmente, mas jobs futuros devem ter cuidado com múltiplas instâncias em produção.

## Débitos Técnicos

- Documentar cobertura real do `AuditInterceptor` por módulo.
- Avaliar cache distribuído caso a aplicação escale para múltiplas instâncias.
- Avaliar configuração de throttling por rota para endpoints sensíveis como login.
- Documentar eventuais jobs agendados quando forem implementados.

## Melhorias Futuras

- Adicionar configuração diferenciada de throttling para `/auth/login`.
- Criar configuração de cache por ambiente.
- Criar módulo de observabilidade estruturada.
- Adicionar health check operacional.

---

# 9. Relação com Outros Módulos

| Módulo | Relação com o AppModule |
|---|---|
| `main.ts` | Cria a aplicação usando `AppModule` |
| `ConfigModule` | Fornece ambiente global |
| `PrismaModule` | Fornece banco para services |
| `AuthModule` | Autenticação e sessão |
| `UsersModule` | Gestão de usuários |
| `BeneficiariesModule` | Gestão de alunos |
| `TurmasModule` | Gestão acadêmica |
| `FrequenciasModule` | Chamadas e diário |
| `UploadModule` | Arquivos e Cloudinary |
| `AuditLogModule` | Registro de auditoria |
| `CertificadosModule` | Certificados e PDFs |
| `Common` | Interceptors, filtros e validações transversais |

---

# 10. Resumo Técnico Final

O `AppModule` é o núcleo de composição da Braille API. Ele reúne os módulos funcionais, configura infraestrutura global e registra mecanismos transversais de segurança, performance, auditoria e tratamento de erros.

## Função do módulo

Compor a aplicação NestJS e registrar dependências globais.

## Importância no sistema

Muito alta. Se o `AppModule` estiver incorreto, a aplicação pode falhar no startup ou carregar módulos sem proteções globais.

## Nível de criticidade

Alto, pois controla configuração, cache, rate limit, auditoria e filtros globais.

## Complexidade

Média. O arquivo não possui lógica de negócio, mas orquestra muitas dependências.

## Principais integrações

- NestJS Core;
- ConfigModule;
- CacheModule;
- ThrottlerModule;
- ScheduleModule;
- PrismaModule;
- AuditInterceptor;
- filtros Prisma.

## Observações finais

O `AppModule` está bem alinhado com uma arquitetura NestJS modular e profissional. Os principais cuidados futuros são cache distribuído, ajuste fino de rate limit e documentação detalhada da cobertura de auditoria por módulo.
