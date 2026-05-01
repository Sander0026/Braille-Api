# 47 — FrequenciasService (`src/frequencias/frequencias.service.ts`)

---

# 1. Visão Geral

O `FrequenciasService` concentra as regras de negócio de chamadas, presenças, faltas, diário fechado e relatórios de frequência.

Responsabilidades principais:

- registrar frequência individual;
- registrar ou atualizar frequências em lote;
- manter compatibilidade entre `status` oficial e campo legado `presente`;
- bloquear chamadas duplicadas;
- bloquear alterações em diário fechado;
- controlar lançamento retroativo;
- preservar `FALTA_JUSTIFICADA`;
- aplicar autojustificativa por atestado ativo;
- listar chamadas com filtros;
- gerar resumo por turma/data;
- calcular relatório individual de presença;
- fechar diário;
- reabrir diário;
- remover chamada;
- executar lote em transação;
- auditar lote em background.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Service Layer;
- Transaction Pattern;
- Batch Upsert Pattern;
- Legacy Compatibility Pattern;
- Diário Lock Pattern;
- Role-based Temporal Rule;
- Report Aggregation Pattern;
- Background Audit Pattern;
- Defensive Error Handling;
- Data Leak Prevention.

## Justificativa Técnica

A frequência é um dado acadêmico sensível. Ela afeta relatórios, presença do aluno, faltas justificadas e histórico pedagógico.

O lote usa transação para garantir integridade atômica e reduzir custo operacional. A auditoria é coletada durante a transação, mas executada depois, para evitar exaurir o pool de conexões do Prisma ou prolongar a transação.

---

# 3. Dependências

| Dependência | Uso |
|---|---|
| `PrismaService` | Persistência de frequências, turmas, alunos e atestados |
| `AuditLogService` | Auditoria do lote |
| `ConfigService` | Ler `FREQUENCIAS_PERMITIR_RETROATIVAS` |

Enums principais:

- `Role`;
- `AuditAcao`;
- `StatusFrequencia`;
- `Prisma`.

---

# 4. Helpers Internos

## `ehHoje()`

Compara se a data da aula é hoje usando ano, mês e dia em UTC.

Ponto de atenção: por usar UTC, pode haver diferença em relação ao dia civil de Brasília em horários próximos à meia-noite.

## `statusFromPresente()`

Converte o campo legado `presente` para `StatusFrequencia`:

```txt
true  → PRESENTE
false → FALTA
```

## `presenteFromStatus()`

Converte o enum oficial para boolean legado:

```txt
PRESENTE → true
outros   → false
```

## `resolverStatus()`

Define o status oficial priorizando `status`. Se `status` não vier, usa `presente` como fallback legado. Se nenhum dos dois vier, lança `BadRequestException`.

## `permiteFrequenciaRetroativa()`

Lê a variável:

```txt
FREQUENCIAS_PERMITIR_RETROATIVAS
```

Padrão:

```txt
true
```

Se for `false`, bloqueia operações retroativas para não-admin.

## `validarDataHoje()`

Bloqueia lançamento/edição/remoção fora do dia atual quando retroatividade está desativada, o usuário não possui bypass e a data não é hoje. Admin possui bypass.

## `verificarDiarioAberto()`

Verifica se existe frequência da turma/data marcada como `fechado = true`. Se existir e a role não for `ADMIN`, lança `ForbiddenException`.

---

# 5. Registro Individual

Método:

```txt
create(dto, auditUser?)
```

Fluxo:

1. converte `dataAula` para `Date`;
2. resolve role do solicitante;
3. resolve status oficial;
4. valida retroatividade;
5. verifica se diário está aberto;
6. procura chamada existente por aluno/turma/data;
7. se existir, lança `ConflictException`;
8. cria frequência;
9. sincroniza `status` e `presente`.

Ponto de atenção: apesar de receber `auditUser`, o método atual não registra auditoria explícita para criação individual.

---

# 6. Lote Transacional

Método:

```txt
salvarLote(dto, auditUser?)
```

Fluxo:

1. converte `dataAula` para `Date`;
2. resolve role;
3. valida retroatividade;
4. verifica diário aberto;
5. monta contexto de auditoria;
6. inicia transação Prisma;
7. pré-carrega frequências existentes dos alunos informados;
8. cria mapa por `alunoId`;
9. cria ou atualiza cada frequência;
10. preserva `FALTA_JUSTIFICADA` existente;
11. se status for `FALTA`, verifica atestado ativo;
12. se houver atestado, altera para `FALTA_JUSTIFICADA`;
13. coleta payload de auditoria;
14. finaliza transação;
15. dispara auditoria sequencial em background.

Configuração da transação:

```txt
maxWait: 10000
timeout: 30000
```

---

# 7. Consultas e Relatórios

## `findAll()`

Filtra por turma, aluno, data, professor e paginação. Inclui aluno e turma com dados mínimos.

## `findResumo()`

Agrupa por `dataAula` e `turmaId`, calcula total, presentes, faltas, diário fechado e nome da turma. Evita N+1 usando mapas em memória.

## `getRelatorioAluno()`

Calcula total de aulas, presenças, faltas, faltas justificadas, taxa de presença e histórico.

---

# 8. Atualização, Remoção e Diário

## `update()`

Valida data, diário fechado, sincroniza `status` e `presente`, limpa `justificativaId` quando a frequência deixa de ser falta justificada e atualiza o registro.

## `remove()`

Valida data, diário fechado e remove a frequência fisicamente.

## `fecharDiario()`

Marca todos os registros da turma/data como fechados, preenchendo `fechadoEm` e `fechadoPor`.

## `reabrirDiario()`

Permite apenas `ADMIN`, reabre os registros e limpa `fechadoEm`/`fechadoPor`.

---

# 9. Segurança e Qualidade

## Segurança

- bloqueia duplicidade de chamada individual;
- bloqueia alteração em diário fechado para não-admin;
- permite bypass administrativo;
- pode bloquear retroatividade por ambiente;
- preserva falta justificada;
- erro crítico do lote não vaza detalhes técnicos do banco;
- lote é transacional.

## Qualidade

- helpers claros para compatibilidade legado/oficial;
- lote evita O(N) conexões;
- auditoria do lote ocorre após transação;
- resumo evita N+1;
- relatórios calculam estatísticas úteis ao frontend.

---

# 10. Pontos de Atenção

- `create()`, `update()`, `remove()`, `fecharDiario()` e `reabrirDiario()` não registram auditoria manual explícita.
- `remove()` faz delete físico; pode impactar rastreabilidade.
- `ehHoje()` usa UTC, não fuso de Brasília.
- `findResumo()` pagina em memória após `groupBy`.
- `reabrirDiario()` permite apenas ADMIN no service, embora controller permita SECRETARIA.
- `dadosParaAtualizar: any` pode ser tipado.

---

# 11. Melhorias Futuras

- Adicionar auditoria manual em todas as mutações.
- Trocar delete físico por cancelamento lógico ou auditoria mais forte.
- Revisar comparação de dia para `America/Sao_Paulo`.
- Padronizar permissão de reabertura.
- Otimizar paginação de resumos agrupados.
- Remover campo legado `presente` após migração.
- Criar testes para diário fechado, retroatividade e lote.

---

# 12. Resumo Técnico Final

O `FrequenciasService` é o núcleo das regras acadêmicas de chamada.

Ele controla status de presença, lote transacional, diário fechado, retroatividade, autojustificativa por atestado e relatórios.

Criticidade: muito alta.

Complexidade: muito alta.

A implementação é robusta no fluxo de lote. Os principais pontos de evolução são auditoria das mutações individuais/diário, revisão de fuso horário e alinhamento das permissões de reabertura.
