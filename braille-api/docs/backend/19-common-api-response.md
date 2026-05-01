# 19 — Common: ApiResponse (`src/common/dto/api-response.dto.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o DTO genérico `ApiResponse<T>`, utilizado para padronizar respostas da Braille API.

O `ApiResponse` encapsula o retorno das operações em uma estrutura previsível para o frontend, com indicação de sucesso, mensagem opcional e carga de dados opcional.

## Responsabilidade

O `ApiResponse<T>` é responsável por:

- padronizar respostas de sucesso;
- padronizar respostas lógicas de erro;
- reduzir boilerplate nos controllers e services;
- documentar a estrutura de resposta no Swagger;
- facilitar consumo pelo frontend;
- tornar retornos mais consistentes entre módulos.

## Estrutura Geral

```ts
ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Generic Response Wrapper;
- Factory Method Pattern;
- API Contract Standardization;
- Swagger Metadata Pattern.

## Justificativa Técnica

Sem um wrapper padronizado, cada controller poderia retornar estruturas diferentes, exigindo tratamentos específicos no frontend.

Com `ApiResponse<T>`, o frontend pode tratar respostas seguindo um contrato comum:

```txt
success → indica resultado lógico
data    → contém payload útil
message → contém mensagem amigável
```

Isso melhora previsibilidade, reduz duplicação no frontend e facilita evolução dos contratos.

---

# 3. Fluxo Interno do Código

## Classe `ApiResponse<T>`

A classe é genérica e aceita qualquer tipo de payload em `data`.

Campos:

| Campo | Tipo | Objetivo |
|---|---|---|
| `success` | boolean | Indica se a operação foi bem-sucedida |
| `message` | string opcional | Mensagem amigável da operação |
| `data` | `T` opcional | Payload retornado |

## Constructor

```ts
constructor(success: boolean, data?: T, message?: string)
```

Responsabilidade:

- inicializar a resposta;
- definir estado lógico da operação;
- anexar payload quando existir;
- anexar mensagem quando existir.

## Factory `ok()`

```ts
static ok<T>(data?: T, message?: string): ApiResponse<T>
```

Responsável por criar respostas de sucesso.

Exemplo conceitual:

```ts
return ApiResponse.ok(aluno, 'Aluno criado com sucesso.');
```

## Factory `error()`

```ts
static error(message: string): ApiResponse<never>
```

Responsável por criar respostas de erro lógico.

Exemplo conceitual:

```ts
return ApiResponse.error('Recurso não encontrado.');
```

Observação: erros HTTP reais normalmente devem continuar sendo lançados por exceptions NestJS, como `BadRequestException`, `NotFoundException` e `UnauthorizedException`.

---

# 4. Dicionário Técnico

## Variáveis e Campos

| Nome | Tipo | Objetivo | Impacto |
|---|---|---|---|
| `success` | boolean | Resultado lógico da operação | Facilita tratamento no frontend |
| `message` | string opcional | Mensagem amigável | Exibe feedback ao usuário |
| `data` | genérico opcional | Payload da resposta | Transporta o resultado útil |

## Métodos

| Método | Parâmetros | Retorno | Objetivo |
|---|---|---|---|
| `constructor()` | `success`, `data`, `message` | instância | Construir resposta manualmente |
| `ok<T>()` | `data?`, `message?` | `ApiResponse<T>` | Criar resposta de sucesso |
| `error()` | `message` | `ApiResponse<never>` | Criar resposta lógica de erro |

## Decorators Swagger

A classe usa `@ApiProperty()` para documentar os campos no Swagger.

Isso auxilia a visualização dos contratos na documentação OpenAPI.

---

# 5. Serviços e Integrações

## APIs

O `ApiResponse` pode ser utilizado por qualquer controller ou service que deseje padronizar retorno.

Uso comum:

- logout;
- perfil;
- auditoria;
- operações administrativas;
- respostas de criação/atualização;
- mensagens de sucesso sem payload.

## Banco de Dados

O DTO não acessa banco de dados.

Ele apenas encapsula dados já produzidos pelos services.

## Serviços Externos

Não possui integração externa além de decorators Swagger.

---

# 6. Segurança e Qualidade

## Segurança

O `ApiResponse` não sanitiza dados por conta própria.

A segurança depende de:

- DTOs de entrada;
- services não retornarem dados sensíveis;
- interceptors/filtros removerem ou ocultarem detalhes internos;
- controllers selecionarem corretamente o payload.

## Qualidade

Pontos positivos:

- classe pequena e clara;
- genérica;
- fácil de reutilizar;
- reduz boilerplate;
- melhora previsibilidade do frontend;
- documentada no Swagger.

## Performance

Impacto irrelevante. A classe apenas cria um objeto simples em memória.

---

# 7. Regras de Uso

Regras recomendadas:

- usar `ApiResponse.ok()` para sucesso lógico;
- usar exceptions NestJS para erros HTTP reais;
- evitar retornar dados sensíveis em `data`;
- manter `message` amigável e sem detalhes internos;
- padronizar módulos novos para usar esse wrapper quando fizer sentido.

---

# 8. Pontos de Atenção

## Riscos

- Nem todas as rotas usam `ApiResponse` uniformemente.
- Misturar retorno bruto e `ApiResponse` pode exigir tratamentos diferentes no frontend.
- `ApiResponse.error()` não define status HTTP; ele representa erro lógico, não exceção HTTP.

## Débitos Técnicos

- Definir política oficial de quando usar `ApiResponse` e quando retornar payload bruto.
- Criar DTOs de resposta específicos para módulos críticos.
- Padronizar respostas de sucesso em endpoints administrativos.

## Melhorias Futuras

- Criar interceptador global opcional para encapsular respostas automaticamente.
- Criar tipos específicos como `PaginatedResponse<T>`.
- Documentar padrão oficial de resposta no índice geral da API.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| Auth | Usa em logout, perfil e operações autenticadas |
| Atestados | Retorna respostas padronizadas em algumas rotas |
| AuditLog | Pode usar para padronização de consultas |
| Common Filters | Complementa padronização de erros HTTP |
| Frontend | Consome `success`, `message` e `data` |

---

# 10. Resumo Técnico Final

O `ApiResponse<T>` é um DTO simples, mas importante para consistência da API.

Ele padroniza respostas lógicas, melhora previsibilidade para o frontend e reduz repetição de código.

Criticidade: média.

Complexidade: baixa.

Recomendação principal: padronizar progressivamente o uso do `ApiResponse` nos módulos administrativos e criar uma política clara para quando retornar wrapper ou payload bruto.
