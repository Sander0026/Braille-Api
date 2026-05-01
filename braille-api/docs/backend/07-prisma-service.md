# 07 — PrismaService e PrismaModule (`src/prisma/`)

---

# 1. Visão Geral

## Objetivo

Este documento descreve o módulo Prisma da Braille API, composto principalmente por:

```txt
src/prisma/prisma.service.ts
src/prisma/prisma.module.ts
```

O Prisma é a camada de acesso ao banco de dados PostgreSQL. O `PrismaService` estende o `PrismaClient` oficial e adiciona integração com o ciclo de vida do NestJS, logging padronizado e estratégia de keep-alive para conexões ociosas.

## Responsabilidade

O `PrismaService` é responsável por:

- fornecer acesso tipado ao banco de dados;
- gerenciar conexão e desconexão com PostgreSQL;
- registrar logs do Prisma Query Engine no Logger do NestJS;
- evitar vazamento de logs sensíveis de queries;
- manter conexão aquecida em ambientes serverless/Neon;
- expor métodos Prisma para services de domínio.

O `PrismaModule` é responsável por:

- registrar `PrismaService` no container NestJS;
- exportar `PrismaService` para outros módulos;
- tornar o serviço global com `@Global()`.

## Fluxo de Funcionamento

```txt
AppModule importa PrismaModule
  ↓
PrismaModule registra PrismaService como provider global
  ↓
NestJS instancia PrismaService
  ↓
constructor configura logs e listeners do Prisma Engine
  ↓
onModuleInit executa $connect()
  ↓
services injetam PrismaService
  ↓
queries são executadas via Prisma Client tipado
  ↓
keep-alive envia SELECT 1 a cada 4 minutos
  ↓
onModuleDestroy limpa intervalo e executa $disconnect()
```

---

# 2. Arquitetura e Metodologias

## Padrões Arquiteturais Identificados

- **Repository Access Abstraction**: services usam PrismaService como porta de acesso ao banco.
- **Singleton Provider Pattern**: o PrismaService é provider único gerenciado pelo NestJS.
- **Global Module Pattern**: `PrismaModule` usa `@Global()` para exportação ampla.
- **Lifecycle Hooks Pattern**: `OnModuleInit` e `OnModuleDestroy` controlam conexão e desconexão.
- **Infrastructure Service Pattern**: serviço não contém regra de negócio, apenas infraestrutura.
- **Logging Adapter Pattern**: eventos do Prisma Engine são redirecionados ao Logger do NestJS.
- **Keep-alive Pattern**: heartbeat periódico mantém conexão aquecida.

## Justificativa Técnica

O Prisma Client é uma dependência central em praticamente todos os módulos da API. Encapsulá-lo em um service NestJS oferece controle de ciclo de vida, padronização de logs e integração com injeção de dependência.

A decisão de usar `@Global()` no `PrismaModule` evita que todos os módulos precisem importar `PrismaModule` individualmente. Como banco de dados é uma dependência transversal, isso simplifica a arquitetura.

O uso de hooks `OnModuleInit` e `OnModuleDestroy` garante:

- conexão explícita no startup;
- encerramento adequado no shutdown;
- menor risco de conexões penduradas;
- logs claros de estado da conexão.

A estratégia de keep-alive foi criada para ambientes como Neon/PostgreSQL serverless, que podem derrubar conexões ociosas após alguns minutos. O heartbeat reduz latência da primeira query após inatividade.

---

# 3. Fluxo Interno do Código

## Fluxo de Execução

### 1. Importações

```ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
```

O arquivo importa decorators e hooks de ciclo de vida do NestJS, o `Logger` e o cliente Prisma.

### 2. Declaração da classe

```ts
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
```

A classe é injetável, herda todos os métodos do Prisma Client e implementa hooks de ciclo de vida.

### 3. Logger interno

```ts
private readonly logger = new Logger(PrismaService.name);
```

Cria logger contextualizado com o nome `PrismaService`.

### 4. Constructor

O constructor define a configuração de logs e registra listeners antes do `$connect()`.

```ts
const logConfig: Prisma.LogDefinition[] = [
  { emit: 'event', level: 'error' },
  { emit: 'event', level: 'warn'  },
  { emit: 'event', level: 'info'  },
];

super({ log: logConfig });
```

Logs de `query` foram intencionalmente desabilitados para evitar exposição de dados sensíveis, como CPF, hashes e parâmetros de consulta.

### 5. Listener de erro

```ts
this.$on('error', (event) => {
  if (event.message.includes('kind: Closed, cause: None')) {
    return;
  }
  this.logger.error(`[Prisma Engine] ${event.message}`);
});
```

Registra erros do Prisma Engine e ignora erro benigno relacionado a conexão ociosa encerrada.

### 6. Listener de warning

```ts
this.$on('warn', (event) => {
  this.logger.warn(`[Prisma Engine] ${event.message}`);
});
```

Registra alertas emitidos pelo Prisma Engine.

### 7. Listener de informação

```ts
this.$on('info', (event) => {
  this.logger.log(`[Prisma Engine] ${event.message}`);
});
```

Registra eventos informativos.

### 8. Keep-alive interval

```ts
private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
```

Guarda referência do intervalo usado para heartbeat e permite limpeza no shutdown.

### 9. Inicialização do módulo

```ts
async onModuleInit(): Promise<void> {
  await this.$connect();
  this.logger.log('Conexão com o banco de dados estabelecida.');

  this.keepAliveInterval = setInterval(async () => {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.debug('[Keep-alive] Heartbeat enviado ao Neon.');
    } catch (err) {
      this.logger.warn(`[Keep-alive] Heartbeat falhou (reconexão será feita na próxima query): ${err}`);
    }
  }, 4 * 60 * 1000);
}
```

Conecta ao banco e inicia heartbeat a cada 4 minutos.

### 10. Destruição do módulo

```ts
async onModuleDestroy(): Promise<void> {
  if (this.keepAliveInterval) {
    clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = null;
  }
  await this.$disconnect();
  this.logger.log('Conexão com o banco de dados encerrada.');
}
```

Limpa o intervalo e desconecta do banco.

### 11. PrismaModule

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Torna o `PrismaService` global e exportável para todos os módulos.

## Dependências Internas

| Dependência | Uso |
|---|---|
| `AppModule` | Importa `PrismaModule` |
| Services de domínio | Injetam `PrismaService` para queries |
| `schema.prisma` | Define tipos e models usados pelo Prisma Client |
| `prisma/migrations` | Evolui estrutura do banco consumida pelo Prisma |

## Dependências Externas

| Biblioteca | Uso |
|---|---|
| `@nestjs/common` | `Injectable`, lifecycle hooks e `Logger` |
| `@prisma/client` | `PrismaClient`, tipos e models gerados |
| PostgreSQL | Banco relacional acessado pelo Prisma |
| Neon/PgBouncer | Ambiente citado nos comentários por idle timeout |

---

# 4. Dicionário Técnico

## Variáveis

| Nome | Tipo | Objetivo | Valor esperado | Impacto no sistema |
|---|---|---|---|---|
| `logger` | `Logger` | Registrar eventos do PrismaService | Instância Nest Logger | Melhora observabilidade interna |
| `logConfig` | `Prisma.LogDefinition[]` | Definir eventos Prisma escutados | Lista com `error`, `warn`, `info` | Controla quais logs do engine são emitidos |
| `keepAliveInterval` | `ReturnType<typeof setInterval> | null` | Guardar intervalo de heartbeat | Intervalo ativo ou `null` | Permite limpar heartbeat no shutdown |
| `event.message` | `string` | Mensagem emitida pelo Prisma Engine | Texto do evento | Usada nos logs internos |
| `err` | `unknown` | Erro capturado no heartbeat | Qualquer erro | Registrado sem interromper aplicação |

## Funções e Métodos

### `constructor()`

| Item | Descrição |
|---|---|
| Objetivo | Configurar Prisma Client e listeners de logs |
| Parâmetros | Nenhum |
| Retorno | Instância do serviço |
| Exceções | Pode falhar se `super()` receber configuração inválida |
| Dependências | `PrismaClient`, `Logger`, eventos Prisma |

### `onModuleInit()`

| Item | Descrição |
|---|---|
| Objetivo | Conectar ao banco e iniciar keep-alive |
| Parâmetros | Nenhum |
| Retorno | `Promise<void>` |
| Exceções | Pode falhar se `$connect()` falhar |
| Dependências | `$connect()`, `$queryRaw`, `setInterval` |

### `onModuleDestroy()`

| Item | Descrição |
|---|---|
| Objetivo | Limpar heartbeat e desconectar do banco |
| Parâmetros | Nenhum |
| Retorno | `Promise<void>` |
| Exceções | Pode falhar se `$disconnect()` falhar |
| Dependências | `clearInterval`, `$disconnect()` |

### `$queryRaw\`SELECT 1\``

Executa heartbeat SQL leve para manter conexão ativa.

## Classes

### `PrismaService`

| Item | Descrição |
|---|---|
| Tipo | Service NestJS |
| Herança | `PrismaClient` |
| Interfaces | `OnModuleInit`, `OnModuleDestroy` |
| Responsabilidade | Gerenciar acesso ao banco e ciclo de conexão |
| Escopo | Provider global por meio do `PrismaModule` |

### `PrismaModule`

| Item | Descrição |
|---|---|
| Tipo | Módulo NestJS global |
| Decorator | `@Global()` |
| Providers | `PrismaService` |
| Exports | `PrismaService` |
| Responsabilidade | Disponibilizar PrismaService na aplicação |

## Interfaces e Tipagens

| Tipo | Origem | Uso |
|---|---|---|
| `OnModuleInit` | NestJS | Hook executado ao inicializar módulo |
| `OnModuleDestroy` | NestJS | Hook executado ao destruir módulo |
| `PrismaClient` | Prisma | Cliente ORM |
| `Prisma.PrismaClientOptions` | Prisma | Opções de configuração do client |
| `'query' | 'info' | 'warn' | 'error'` | Prisma event types | Tipos de eventos disponíveis para listeners |

---

# 5. Serviços e Integrações

## APIs

O PrismaService não expõe endpoints HTTP diretamente. Ele é consumido por services que atendem controllers.

## Banco de Dados

O PrismaService é a principal camada de acesso ao PostgreSQL.

Ele fornece métodos gerados a partir dos models definidos em `schema.prisma`, como:

- `user`;
- `userSession`;
- `aluno`;
- `turma`;
- `frequencia`;
- `comunicado`;
- `auditLog`;
- `certificadoEmitido`;
- `modeloCertificado`;
- `apoiador`.

Também permite queries raw, como o heartbeat:

```sql
SELECT 1
```

## Serviços Externos

### PostgreSQL / Neon

O código indica otimização para Neon Serverless PostgreSQL, que pode derrubar conexões ociosas após aproximadamente 5 minutos.

A estratégia implementada envia heartbeat a cada 4 minutos para reduzir reconexão TLS na primeira query real após inatividade.

---

# 6. Segurança e Qualidade

## Segurança

### Logs de query desabilitados

O código evita logs de queries por conterem parâmetros potencialmente sensíveis.

Dados que poderiam vazar se queries fossem logadas:

- CPF;
- RG;
- e-mail;
- hashes de senha;
- hashes de refresh token;
- dados médicos;
- termos LGPD;
- URLs privadas/operacionais.

### Não exposição de target

O listener de erro registra apenas `event.message`, não o `event.target`, reduzindo exposição interna.

### Tratamento de erro benigno

O erro `kind: Closed, cause: None` é ignorado por ser considerado benigno em cenários de idle timeout.

## Qualidade

Pontos positivos:

- service coeso;
- ciclo de vida bem definido;
- logs centralizados;
- comentários técnicos úteis;
- separação clara entre módulo e service;
- provider global simples.

## Performance

O heartbeat reduz latência após inatividade em bancos serverless.

Trade-off:

- gera uma query simples a cada 4 minutos;
- mantém conexão ativa;
- melhora tempo de resposta da primeira query após ociosidade;
- pode ser desnecessário em bancos tradicionais com conexão estável.

---

# 7. Regras de Negócio

O PrismaService não contém regras de negócio institucionais.

Entretanto, impõe regras técnicas globais:

- toda conexão com banco passa pelo Prisma Client;
- logs de query não devem ser ativados em produção;
- conexão deve ser aberta no startup;
- conexão deve ser encerrada no shutdown;
- heartbeat deve manter conexão Neon aquecida;
- erros do Prisma Engine devem ser roteados para Logger do NestJS.

---

# 8. Pontos de Atenção

## Riscos

- O heartbeat roda em todas as instâncias da aplicação. Em escala horizontal, cada instância enviará `SELECT 1` periodicamente.
- O uso de `@Global()` simplifica injeção, mas pode esconder dependências explícitas entre módulos.
- O comentário menciona query logs apenas fora de produção, mas a implementação atual desabilita query logs completamente.
- O heartbeat é específico para Neon/PgBouncer; em outro provedor, pode ser desnecessário.

## Débitos Técnicos

- Avaliar se heartbeat deve ser configurável por variável de ambiente.
- Avaliar se query logs deveriam poder ser ativados apenas em desenvolvimento com flag explícita.
- Documentar estratégia de pool/conexões para produção.
- Adicionar health check de banco em módulo dedicado.

## Melhorias Futuras

- Criar variável `DATABASE_KEEP_ALIVE_ENABLED`.
- Criar variável `DATABASE_KEEP_ALIVE_INTERVAL_MS`.
- Adicionar health endpoint com verificação Prisma.
- Adicionar métricas de latência das queries críticas.
- Usar logger estruturado para eventos do Prisma.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AppModule` | Importa `PrismaModule` |
| `AuthService` | Consulta usuários e sessões |
| `UsersService` | CRUD de usuários |
| `BeneficiariesService` | CRUD de alunos e importação/exportação |
| `TurmasService` | Turmas, matrículas e grade |
| `FrequenciasService` | Chamadas e relatórios |
| `AtestadosService` | Justificativas de faltas |
| `ComunicadosService` | Mural e autores |
| `SiteConfigService` | CMS público |
| `AuditLogService` | Registra ações críticas |
| `CertificadosService` | Modelos e certificados emitidos |

---

# 10. Resumo Técnico Final

O `PrismaService` é a infraestrutura central de persistência da Braille API. Ele encapsula o Prisma Client, gerencia ciclo de conexão, roteia logs do Prisma Engine e mantém heartbeat para banco serverless.

## Função do módulo

Fornecer acesso global, tipado e controlado ao banco PostgreSQL.

## Importância no sistema

Muito alta. Praticamente todos os services dependem direta ou indiretamente do PrismaService.

## Nível de criticidade

Alto. Falhas nesse serviço afetam autenticação, usuários, alunos, turmas, frequências, documentos, certificados e auditoria.

## Complexidade

Média. A lógica é pequena, mas envolve conexão, logging, ciclo de vida e performance.

## Principais integrações

- Prisma Client;
- PostgreSQL;
- Neon/PgBouncer;
- NestJS Logger;
- NestJS lifecycle hooks.

## Observações finais

A implementação está bem estruturada e profissional, especialmente por evitar logs de query sensíveis e gerenciar conexão no ciclo de vida do NestJS. O principal ponto de melhoria futura é tornar o keep-alive configurável por ambiente.
