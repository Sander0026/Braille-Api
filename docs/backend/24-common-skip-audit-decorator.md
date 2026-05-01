# 24 — Common: SkipAudit Decorator (`src/common/decorators/skip-audit.decorator.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o decorator `@SkipAudit()`, usado para desativar a auditoria automática do `AuditInterceptor` em controllers ou rotas específicas.

Arquivo documentado:

```txt
src/common/decorators/skip-audit.decorator.ts
```

## Responsabilidade

O `@SkipAudit()` é responsável por marcar uma rota ou controller para não ser auditado automaticamente pelo `AuditInterceptor`.

Essa decisão é útil quando:

- o módulo já realiza auditoria manual no service;
- a operação precisa registrar dados mais específicos do que o interceptor consegue inferir;
- a auditoria automática poderia gerar duplicidade;
- o controller possui múltiplas ações complexas que precisam de contexto de negócio.

## Fluxo de Funcionamento

```txt
Controller ou método usa @SkipAudit()
  ↓
Decorator grava metadata skipAutomaticAudit = true
  ↓
AuditInterceptor lê metadata via Reflector
  ↓
Se verdadeiro, retorna next.handle()
  ↓
Auditoria automática é ignorada
  ↓
Service pode registrar auditoria manualmente
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Decorator Metadata Pattern;
- Interceptor Opt-out Pattern;
- Explicit Audit Control;
- Manual Audit Strategy;
- Separation of Concerns.

## Justificativa Técnica

A auditoria automática é útil, mas nem sempre tem contexto suficiente para registrar a ação de forma perfeita.

Alguns fluxos precisam registrar:

- valor anterior e novo com mais precisão;
- ação de negócio específica;
- entidade diferente da inferida pela URL;
- operação composta em transação;
- remoção de arquivos externos;
- impacto em entidades relacionadas.

Nesses casos, `@SkipAudit()` evita registro automático incompleto ou duplicado e permite que o service registre a auditoria correta.

---

# 3. Fluxo Interno do Código

## Constante `SKIP_AUDIT_KEY`

```txt
skipAutomaticAudit
```

É a chave de metadata usada pelo decorator e lida pelo `AuditInterceptor`.

## Função `SkipAudit()`

A função retorna:

```ts
SetMetadata(SKIP_AUDIT_KEY, true)
```

Isso grava metadata no método ou classe onde o decorator foi aplicado.

## Leitura pelo `AuditInterceptor`

O interceptor usa `Reflector.getAllAndOverride()` para verificar se a rota ou controller possui a metadata de skip.

Se existir, a auditoria automática é desativada para aquela execução.

---

# 4. Dicionário Técnico

## Constantes

| Nome | Valor | Objetivo |
|---|---|---|
| `SKIP_AUDIT_KEY` | `skipAutomaticAudit` | Chave de metadata da auditoria automática |

## Funções

| Função | Retorno | Objetivo |
|---|---|---|
| `SkipAudit()` | Decorator metadata | Marcar rota/controller para ignorar auditoria automática |

## Integrações

| Item | Uso |
|---|---|
| `SetMetadata` | Grava metadata no NestJS |
| `Reflector` | Lê metadata no interceptor |
| `AuditInterceptor` | Decide se audita ou ignora |

---

# 5. Serviços e Integrações

## APIs

O decorator não expõe endpoints.

Ele é aplicado em controllers ou métodos.

Exemplo conceitual:

```ts
@SkipAudit()
@Controller('turmas')
export class TurmasController {}
```

## Banco de Dados

O decorator não acessa banco.

Ele apenas influencia se o `AuditInterceptor` chamará ou não o `AuditLogService` automaticamente.

## Serviços Externos

Não há integração externa.

---

# 6. Segurança e Qualidade

## Segurança

Pontos positivos:

- evita auditoria automática incompleta em operações sensíveis;
- força módulos complexos a registrar auditoria manual com mais precisão;
- reduz risco de duplicidade de logs;
- torna a intenção explícita no controller.

## Qualidade

Pontos positivos:

- decorator simples;
- baixo acoplamento;
- fácil leitura;
- integração direta com o interceptor;
- comportamento previsível.

## Performance

Impacto irrelevante. A leitura de metadata é leve e ocorre no interceptor.

---

# 7. Regras de Uso

Use `@SkipAudit()` quando:

- o service já registra auditoria manual;
- a operação envolve múltiplas entidades;
- a ação não pode ser inferida corretamente pelo path;
- o payload precisa de sanitização/contexto específico;
- a auditoria automática geraria registro duplicado.

Evite `@SkipAudit()` quando:

- não houver auditoria manual equivalente;
- a rota executa mutação importante;
- a operação altera dados sensíveis;
- o motivo do skip não estiver claro.

---

# 8. Pontos de Atenção

## Riscos

- Usar `@SkipAudit()` sem auditoria manual pode criar lacuna de rastreabilidade.
- Controllers inteiros com `@SkipAudit()` exigem disciplina nos services.
- Novos métodos adicionados em controller com `@SkipAudit()` podem não ser auditados se o desenvolvedor esquecer auditoria manual.

## Débitos Técnicos

- Documentar quais controllers usam `@SkipAudit()` e onde registram auditoria manual.
- Criar testes que garantam auditoria manual em rotas com skip.
- Criar regra de revisão de código: todo `@SkipAudit()` precisa ter justificativa.

## Melhorias Futuras

- Criar decorator mais explícito, como `@ManualAudit()`.
- Adicionar comentário obrigatório junto ao decorator em controllers sensíveis.
- Criar lint/check para localizar `@SkipAudit()` sem chamada manual de auditoria.
- Criar tabela de cobertura de auditoria por módulo.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `AuditInterceptor` | Lê a metadata e ignora auditoria automática |
| `AuditLogService` | Deve ser chamado manualmente quando necessário |
| Controllers | Aplicam `@SkipAudit()` em classe ou método |
| Services | Assumem responsabilidade de auditoria manual |
| `Reflector` | Permite leitura da metadata |

---

# 10. Resumo Técnico Final

O `@SkipAudit()` é um decorator simples, mas importante para controlar a auditoria transversal da API.

Ele evita duplicidade e permite auditoria manual mais precisa em módulos complexos.

Criticidade: média/alta.

Complexidade: baixa.

O principal cuidado é garantir que toda rota com `@SkipAudit()` tenha auditoria manual equivalente quando alterar dados relevantes.
