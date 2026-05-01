# 20 — Common: Filtros Prisma (`prisma-exception.filter.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar os filtros globais responsáveis por tratar exceções do Prisma na Braille API.

Arquivo documentado:

```txt
src/common/filters/prisma-exception.filter.ts
```

Filtros principais:

- `PrismaExceptionFilter`;
- `PrismaValidationFilter`.

## Responsabilidade

Os filtros Prisma têm a responsabilidade de transformar erros técnicos do ORM em respostas HTTP seguras, padronizadas e compreensíveis para o cliente.

Eles impedem que mensagens internas do Prisma sejam retornadas diretamente ao frontend, reduzindo risco de vazamento de informações como:

- nomes de tabelas;
- nomes de colunas;
- estrutura do schema;
- detalhes de queries;
- constraints internas;
- mensagens técnicas do banco.

## Fluxo de Funcionamento

```txt
Service executa operação Prisma
  ↓
Prisma lança erro conhecido ou erro de validação
  ↓
Filtro global captura exceção
  ↓
Erro é mapeado para status HTTP seguro
  ↓
Detalhes técnicos são enviados apenas ao Logger
  ↓
Cliente recebe mensagem pública e genérica
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Exception Filter Pattern;
- Error Mapping Pattern;
- Secure Error Handling;
- Fail-safe Response Pattern;
- Server-side Logging;
- CWE-209 Mitigation.

## Justificativa Técnica

Erros do Prisma podem conter detalhes internos do banco. Retornar essas mensagens diretamente ao cliente seria inseguro e pouco profissional.

Os filtros resolvem isso ao separar:

```txt
Detalhe técnico → Logger do servidor
Mensagem pública → Cliente HTTP
```

Essa separação melhora segurança, observabilidade e experiência do consumidor da API.

---

# 3. Fluxo Interno do Código

## `HTTP_STATUS_BY_CODE`

Mapeia códigos conhecidos do Prisma para HTTP status.

| Código Prisma | Status HTTP | Motivo |
|---|---:|---|
| `P2002` | 409 Conflict | Violação de unique constraint |
| `P2003` | 400 Bad Request | Violação de relação/chave estrangeira |
| `P2025` | 404 Not Found | Registro não encontrado |

Códigos não mapeados retornam `500 Internal Server Error`.

## `resolveHttpStatus()`

Função responsável por resolver o status HTTP de acordo com o código Prisma.

Se o código não existir no mapa, retorna `500`.

## Mensagens Públicas

As mensagens públicas ficam centralizadas em `MSG_PUBLICAS`.

Elas são amigáveis e não expõem detalhes internos.

Exemplos de intenção:

- campo já está em uso;
- operação inválida por vínculo com outras entidades;
- registro solicitado não foi encontrado.

## `PrismaExceptionFilter`

Captura:

```txt
Prisma.PrismaClientKnownRequestError
```

Responsabilidades:

- identificar código Prisma;
- decidir status HTTP;
- registrar log técnico;
- retornar mensagem pública;
- tratar códigos desconhecidos como erro interno.

## `PrismaValidationFilter`

Captura:

```txt
Prisma.PrismaClientValidationError
```

Responsabilidades:

- registrar mensagem completa no servidor;
- retornar `400 Bad Request` ao cliente;
- evitar exposição de schema, modelos e campos esperados.

---

# 4. Dicionário Técnico

## Constantes

| Nome | Objetivo |
|---|---|
| `HTTP_STATUS_BY_CODE` | Mapear códigos Prisma para status HTTP |
| `MSG_PUBLICAS` | Centralizar mensagens seguras para o cliente |
| `MSG_DEFAULT_PUBLICO` | Mensagem genérica para erro interno |
| `MSG_VALIDACAO_PUBLICO` | Mensagem genérica para erro de validação Prisma |

## Funções e Métodos

| Função/Método | Objetivo |
|---|---|
| `resolveHttpStatus()` | Converter código Prisma em status HTTP |
| `PrismaExceptionFilter.catch()` | Tratar erros conhecidos do Prisma |
| `PrismaValidationFilter.catch()` | Tratar erros de validação do Prisma |

## Classes

| Classe | Responsabilidade |
|---|---|
| `PrismaExceptionFilter` | Capturar `PrismaClientKnownRequestError` |
| `PrismaValidationFilter` | Capturar `PrismaClientValidationError` |

## Tipos Externos

| Tipo | Origem | Uso |
|---|---|---|
| `ExceptionFilter` | NestJS | Contrato de filtro |
| `ArgumentsHost` | NestJS | Acesso ao contexto HTTP |
| `HttpStatus` | NestJS | Status HTTP padronizados |
| `Logger` | NestJS | Log interno do servidor |
| `Response` | Express | Envio de resposta HTTP |
| `PrismaClientKnownRequestError` | Prisma | Erro Prisma conhecido |
| `PrismaClientValidationError` | Prisma | Erro Prisma de validação |

---

# 5. Serviços e Integrações

## APIs

Os filtros não expõem endpoints. Eles atuam globalmente sobre erros lançados durante o processamento das rotas.

## Banco de Dados

Os filtros tratam erros oriundos das operações Prisma sobre o PostgreSQL.

Impactam todos os módulos que usam `PrismaService`, como:

- Auth;
- Users;
- Beneficiaries;
- Turmas;
- Frequências;
- Comunicados;
- Certificados;
- Apoiadores;
- AuditLog.

## Serviços Externos

Não há integração externa além de Prisma, NestJS Logger e Express Response.

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- não retorna mensagem raw do Prisma ao cliente;
- reduz risco de vazamento de schema;
- evita expor nomes internos de tabelas e colunas;
- trata códigos conhecidos com mensagens públicas;
- códigos desconhecidos viram erro genérico;
- detalhes ficam apenas no log do servidor.

## Qualidade

Pontos positivos:

- mapeamento centralizado;
- mensagens públicas padronizadas;
- logs técnicos preservados;
- separação clara entre erro conhecido e desconhecido;
- filtros globais reduzem repetição nos services.

## Performance

Impacto baixo. O filtro só executa quando ocorre exceção.

---

# 7. Regras de Negócio Transversais

- violação de unicidade deve retornar conflito;
- violação de vínculo relacional deve retornar requisição inválida;
- registro não encontrado deve retornar 404;
- erro Prisma desconhecido não deve expor detalhes;
- erro de validação Prisma deve retornar mensagem pública genérica;
- logs internos devem manter detalhes suficientes para diagnóstico técnico.

---

# 8. Pontos de Atenção

## Riscos

- Códigos Prisma não mapeados retornam 500 genérico; isso é seguro, mas pode esconder um caso de negócio que deveria ter mensagem melhor.
- Logs técnicos podem conter detalhes sensíveis; o ambiente de logs precisa ser protegido.
- O mapeamento atual cobre apenas os principais códigos usados pelo sistema.

## Débitos Técnicos

- Mapear outros códigos Prisma conforme surgirem em produção.
- Criar testes unitários para cada código tratado.
- Padronizar formato de erro com `ApiResponse` ou envelope comum, se o projeto decidir usar wrapper global.
- Adicionar correlation ID nos logs para rastrear requisições.

## Melhorias Futuras

- Criar enum interno para códigos Prisma tratados.
- Criar helper para resposta de erro padronizada.
- Integrar logs estruturados.
- Criar alerta para códigos Prisma não mapeados.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AppModule` | Registra os filtros como `APP_FILTER` |
| `PrismaService` | Origem das operações que podem lançar erros |
| Services de domínio | Beneficiam-se do tratamento global |
| Frontend | Recebe mensagens mais estáveis e seguras |
| Logs/observabilidade | Recebem detalhes técnicos do erro |

---

# 10. Resumo Técnico Final

Os filtros Prisma são uma camada essencial de segurança e qualidade da Braille API.

Eles traduzem erros técnicos do ORM em respostas públicas seguras, preservam detalhes no servidor e reduzem vazamento de estrutura interna do banco.

Criticidade: alta.

Complexidade: média.

A implementação está profissional. O principal próximo passo é ampliar testes e mapear novos códigos Prisma conforme o sistema evoluir.
