# 44 — Turmas: Scheduler e Cache

---

# 1. Visão Geral

Este documento detalha os mecanismos automáticos e de performance do módulo `Turmas`:

- scheduler diário de atualização de status;
- uso de cache em rotas de leitura;
- riscos de consistência temporária;
- pontos de atenção para auditoria automática.

Arquivos relacionados:

```txt
src/turmas/turmas.scheduler.ts
src/turmas/turmas.controller.ts
src/turmas/turmas.service.ts
src/app.module.ts
```

---

# 2. TurmasScheduler

## Objetivo

O `TurmasScheduler` automatiza mudanças de status acadêmico com base nas datas da turma.

Ele evita que turmas permaneçam manualmente em status desatualizado quando chegam à data de início ou passam da data de fim.

## Dependência

| Dependência | Uso |
|---|---|
| `PrismaService` | Executar atualizações em lote no model `Turma` |

## Cron

A rotina usa:

```txt
@Cron('0 0 * * *', { timeZone: 'America/Sao_Paulo' })
```

Isso significa:

```txt
todos os dias à meia-noite no fuso de São Paulo
```

---

# 3. Regras Automáticas de Status

## PREVISTA → ANDAMENTO

Condição:

```txt
status = PREVISTA
dataInicio <= hoje
```

Ação:

```txt
status = ANDAMENTO
```

## ANDAMENTO → CONCLUIDA

Condição:

```txt
status = ANDAMENTO
dataFim < hoje
```

Ação:

```txt
status = CONCLUIDA
```

## Normalização do Dia

O scheduler cria a data `hoje` e força:

```txt
00:00:00.000
```

Isso evita comparar a hora atual com datas que representam apenas o dia acadêmico.

---

# 4. Estratégia de Atualização

O scheduler usa `updateMany()`.

Vantagens:

- eficiente para atualizações em lote;
- evita carregar todas as turmas na memória;
- reduz quantidade de queries;
- adequado para rotina diária simples.

Limitação:

- não registra auditoria individual por turma;
- não aplica lógica de transição do `TurmasService.aplicarTransicaoStatus()`;
- não atualiza status das matrículas ativas quando a turma passa para `CONCLUIDA` automaticamente.

Esse é um ponto importante de evolução.

---

# 5. Logging do Scheduler

O scheduler registra:

- início da verificação;
- quantidade de turmas alteradas de `PREVISTA` para `ANDAMENTO`;
- quantidade de turmas alteradas de `ANDAMENTO` para `CONCLUIDA`;
- conclusão com sucesso;
- erro fatal com stack trace.

Esses logs são importantes para diagnóstico operacional.

---

# 6. Cache nas Consultas de Turmas

## Rotas com Cache

O `TurmasController` usa `CacheInterceptor` em:

```txt
GET /turmas
GET /turmas/professores-ativos
GET /turmas/:id
```

Configuração:

```txt
@UseInterceptors(CacheInterceptor)
@CacheTTL(30000)
```

## Objetivo

O cache reduz:

- leituras repetidas do banco;
- tempo de resposta em consultas frequentes;
- carga operacional em telas de listagem/detalhe.

## Duração

`CacheTTL(30000)` representa TTL configurado para a rota.

Dependendo da configuração do cache-manager/NestJS, é importante confirmar a unidade efetiva adotada pelo projeto para evitar TTL diferente do esperado.

---

# 7. Consistência Temporária

Como as rotas de leitura são cacheadas, mutações podem não aparecer imediatamente.

Exemplos:

- criar turma e listagem ainda não mostrar por alguns segundos;
- matricular aluno e detalhe da turma ainda mostrar lista antiga;
- mudar status e listagem ainda exibir status anterior;
- ocultar/restaurar turma e consulta ainda refletir estado anterior.

Esse comportamento é aceitável em cache de curta duração, mas deve ser conhecido pelo frontend e pela equipe.

---

# 8. Relação entre Scheduler e Cache

O scheduler altera status diretamente no banco.

Se houver cache ativo no momento da execução, consultas podem continuar exibindo status antigo até expirar o TTL.

Isso significa que:

```txt
Banco atualizado ≠ resposta HTTP imediatamente atualizada
```

Para operações administrativas críticas, uma estratégia futura de invalidação explícita é recomendada.

---

# 9. Segurança e Qualidade

## Segurança

Pontos positivos:

- scheduler roda server-side;
- não depende do frontend;
- usa fuso de São Paulo;
- erros são capturados e logados;
- cache é aplicado apenas em rotas autenticadas.

## Qualidade

Pontos positivos:

- atualização automática reduz trabalho manual;
- `updateMany()` é eficiente;
- logs indicam quantas turmas foram alteradas;
- cache melhora performance das telas de leitura.

## Performance

- scheduler usa atualização em lote;
- cache reduz consultas repetidas;
- listagens continuam paginadas no service;
- consultas frequentes evitam hit direto no banco dentro do TTL.

---

# 10. Pontos de Atenção

## Riscos

- Scheduler não registra auditoria individual.
- Scheduler não atualiza status das matrículas ativas ao concluir turma automaticamente.
- Cache pode exibir dados defasados após mutações.
- Se o servidor estiver fora do ar à meia-noite, a rotina só roda na próxima execução.
- `CacheTTL(30000)` precisa ter unidade confirmada conforme versão/configuração.

## Débitos Técnicos

- Usar serviço/transação comum para mudanças automáticas de status.
- Registrar auditoria do scheduler.
- Atualizar matrículas quando turma for concluída automaticamente.
- Criar invalidação explícita de cache após mutações.
- Criar testes para cron e regras de data.

---

# 11. Melhorias Futuras

- Scheduler chamar método transacional do service;
- auditoria com autor técnico `SYSTEM`;
- evento interno `TurmaStatusChanged`;
- fila para processar mudanças automáticas;
- invalidação seletiva de cache;
- painel de execução de rotinas;
- healthcheck de última execução do scheduler;
- atualização automática das matrículas ao concluir turma.

---

# 12. Resumo Técnico Final

O scheduler e o cache do módulo `Turmas` melhoram automação e performance, mas exigem atenção à consistência e rastreabilidade.

O scheduler automatiza status por data e o cache melhora leitura, porém os próximos passos mais importantes são auditar mudanças automáticas, atualizar matrículas quando turmas forem concluídas pelo cron e invalidar cache após mutações.

Criticidade: alta.

Complexidade: média/alta.
