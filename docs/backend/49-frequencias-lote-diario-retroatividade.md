# 49 — Frequências: Lote, Diário e Retroatividade

---

# 1. Visão Geral

Este documento detalha as regras mais críticas do módulo `Frequencias`, especialmente os fluxos de:

- chamada em lote;
- transação atômica;
- preservação de falta justificada;
- autojustificativa por atestado;
- fechamento de diário;
- reabertura de diário;
- bloqueio de alterações retroativas;
- sincronização entre `status` oficial e campo legado `presente`.

Arquivos relacionados:

```txt
src/frequencias/frequencias.service.ts
src/frequencias/frequencias.controller.ts
src/frequencias/dto/create-frequencia-lote.dto.ts
src/frequencias/dto/create-frequencia.dto.ts
src/frequencias/dto/update-frequencia.dto.ts
```

---

# 2. Contexto Técnico

O domínio de frequência é sensível porque impacta diretamente:

- histórico acadêmico;
- relatórios de presença;
- faltas justificadas;
- fechamento de diário;
- retificações administrativas;
- dados pedagógicos de alunos e turmas.

Por isso, o service usa validações de data, diário fechado, transação em lote e regras específicas para evitar perda de informação importante.

---

# 3. Status Oficial e Campo Legado

## Status oficial

Campo principal:

```txt
status: StatusFrequencia
```

Estados principais usados no fluxo:

- `PRESENTE`;
- `FALTA`;
- `FALTA_JUSTIFICADA`.

## Campo legado

Campo antigo:

```txt
presente: boolean
```

Esse campo permanece temporariamente por compatibilidade com o frontend.

## Regra de prioridade

O helper `resolverStatus()` aplica esta prioridade:

```txt
1. se status foi informado, usar status
2. se status não foi informado e presente é boolean, converter presente
3. se nenhum foi informado, lançar BadRequestException
```

## Sincronização

Toda escrita deve manter os dois campos sincronizados:

| Status | presente |
|---|---:|
| `PRESENTE` | `true` |
| `FALTA` | `false` |
| `FALTA_JUSTIFICADA` | `false` |

---

# 4. Controle de Retroatividade

## Variável de ambiente

```txt
FREQUENCIAS_PERMITIR_RETROATIVAS
```

Valor padrão:

```txt
true
```

## Método

```txt
permiteFrequenciaRetroativa()
```

Regra:

- se o valor da env for diferente de `false`, retroatividade permanece permitida;
- se for exatamente `false`, o service bloqueia operações retroativas para perfis sem bypass.

## Bypass administrativo

O método `validarDataHoje(dataAula, bypass)` permite bypass para:

```txt
ADMIN
```

Assim, mesmo com retroatividade bloqueada, o administrador pode retificar chamadas antigas.

## Ponto de atenção de fuso

O método `ehHoje()` compara a data em UTC.

Risco:

```txt
Em horários próximos à meia-noite, o dia UTC pode divergir do dia civil em America/Sao_Paulo.
```

Melhoria recomendada: comparar dia usando fuso de Brasília.

---

# 5. Diário Fechado

## Conceito

O diário fechado representa a consolidação da chamada de uma turma em uma data.

Quando fechado:

- registros ficam bloqueados para não-admin;
- professores e secretaria não conseguem alterar;
- apenas admin pode reabrir para retificação.

## Verificação

Método:

```txt
verificarDiarioAberto(turmaId, dataAula, role)
```

Fluxo:

1. busca qualquer frequência da turma/data com `fechado = true`;
2. se encontrar e a role não for `ADMIN`, lança `ForbiddenException`;
3. se não houver fechamento ou se for admin, permite seguir.

## Impacto

Essa regra é chamada antes de:

- criar frequência individual;
- salvar lote;
- atualizar frequência;
- remover frequência.

---

# 6. Fechamento do Diário

## Endpoint

```txt
POST /frequencias/diario/fechar/:turmaId/:dataAula
```

Perfis no controller:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

## Método

```txt
fecharDiario(turmaId, dataAula, auditUser?)
```

## Regras

- professor só fecha diário do dia atual;
- admin pode fechar qualquer data;
- precisa haver registros de frequência para a turma/data;
- se todos os registros já estão fechados, lança erro;
- fecha todos os registros da turma/data.

## Campos atualizados

```txt
fechado = true
fechadoEm = new Date()
fechadoPor = userId
```

## Retorno

Retorna:

- mensagem de sucesso;
- turmaId;
- dataAula;
- total de registros fechados.

---

# 7. Reabertura do Diário

## Endpoint

```txt
POST /frequencias/diario/reabrir/:turmaId/:dataAula
```

Perfis no controller:

```txt
ADMIN
SECRETARIA
```

Regra efetiva no service:

```txt
somente ADMIN
```

## Método

```txt
reabrirDiario(turmaId, dataAula, auditUser?)
```

## Regras

- se role não for `ADMIN`, lança `ForbiddenException`;
- reabre registros fechados da turma/data;
- limpa metadados de fechamento.

## Campos atualizados

```txt
fechado = false
fechadoEm = null
fechadoPor = null
```

## Ponto de atenção

Existe desalinhamento entre controller e service:

```txt
Controller permite ADMIN/SECRETARIA
Service permite somente ADMIN
```

A regra mais segura é a do service, mas a documentação Swagger/roles do controller deve ser padronizada para evitar confusão operacional.

---

# 8. Chamada em Lote

## Endpoint

```txt
POST /frequencias/lote
```

Perfis:

```txt
ADMIN
SECRETARIA
PROFESSOR
```

## DTO

```txt
CreateFrequenciaLoteDto
```

Estrutura:

```txt
dataAula
turmaId
alunos[]
```

Cada aluno contém:

```txt
alunoId
status
presente
frequenciaId
```

## Método

```txt
salvarLote(dto, auditUser?)
```

---

# 9. Estratégia Transacional

O lote usa:

```txt
prisma.$transaction()
```

Configuração:

```txt
maxWait: 10000
timeout: 30000
```

## Por que usar transação

A transação garante que a chamada em lote seja atômica:

```txt
ou todos os registros são processados com sucesso
ou toda a operação é abortada
```

Isso evita estado parcial de chamada em uma turma/data.

## Pré-carregamento

Antes de iterar os alunos, o service busca todas as frequências existentes da turma/data para os alunos enviados.

Depois cria:

```txt
Map<alunoId, frequencia>
```

Benefícios:

- reduz consultas repetidas;
- evita N consultas para N alunos;
- melhora performance do lote;
- facilita upsert lógico.

---

# 10. Upsert Lógico por Aluno

Para cada aluno do lote:

## Se já existe frequência

- guarda `oldValue`;
- resolve status;
- se não for falta justificada preservada, atualiza status/presente;
- define ação de auditoria como `ATUALIZAR`.

## Se não existe frequência

- cria nova frequência;
- define ação de auditoria como `CRIAR`.

## Observação sobre `frequenciaId`

O DTO possui `frequenciaId`, mas o service prioriza a busca por:

```txt
turmaId + dataAula + alunoId
```

Essa estratégia é mais confiável para evitar duplicidade operacional.

---

# 11. Preservação de Falta Justificada

Regra importante:

```txt
Se uma frequência existente já está como FALTA_JUSTIFICADA, o lote não sobrescreve o status.
```

Motivo:

- preservar justificativas médicas;
- evitar que chamada em lote apague uma justificativa já validada;
- proteger vínculo com atestado.

Essa é uma decisão técnica correta para integridade acadêmica.

---

# 12. Autojustificativa por Atestado

Quando o status resolvido do lote é:

```txt
FALTA
```

O service busca atestado ativo do aluno:

```txt
alunoId = aluno.alunoId
dataInicio <= dataAula
dataFim >= dataAula
```

Se encontrar, a frequência é atualizada para:

```txt
status = FALTA_JUSTIFICADA
presente = false
justificativaId = atestado.id
```

## Impacto

Essa regra permite que uma falta lançada em data coberta por atestado seja automaticamente justificada.

Isso reduz retrabalho administrativo e evita inconsistência entre atestados e frequência.

---

# 13. Auditoria do Lote

Durante a transação, o service coleta payloads de auditoria em memória.

Após a transação, executa auditoria em background:

```txt
Promise.resolve().then(async () => { ... })
```

A auditoria é sequencial:

```txt
for (const payload of auditPayloads) await auditService.registrar(payload)
```

## Justificativa

Essa abordagem evita:

- concorrência pesada no meio da transação;
- exaustão do pool de conexões;
- aumento do tempo da transação;
- falha de auditoria derrubando a operação principal.

## Ponto de atenção

Como a auditoria é não bloqueante, falhas são registradas como warning, mas não impedem a resposta de sucesso do lote.

---

# 14. Tratamento de Erros do Lote

Se a transação falhar, o service registra erro interno e retorna:

```txt
InternalServerErrorException
```

Mensagem pública:

```txt
Falha ao processar o Lote de Chamadas. O banco de dados abortou a transação.
```

## Segurança

O service não repassa `error.message` nativo do banco para o cliente.

Isso evita vazamento de detalhes internos do PostgreSQL/Prisma.

---

# 15. Atualização Individual

Método:

```txt
update(id, dto, auditUser?)
```

Regras:

- busca frequência;
- valida retroatividade;
- verifica diário fechado;
- converte `dataAula` se enviada;
- resolve status se `status` ou `presente` vierem no DTO;
- sincroniza `status` e `presente`;
- limpa `justificativaId` quando status não é `FALTA_JUSTIFICADA`.

Ponto de atenção: a atualização individual ainda não possui auditoria manual explícita.

---

# 16. Remoção Individual

Método:

```txt
remove(id, auditUser?)
```

Regras:

- busca frequência;
- valida retroatividade;
- verifica diário fechado;
- executa delete físico.

## Ponto de atenção

Delete físico pode reduzir rastreabilidade acadêmica.

Melhorias possíveis:

- soft delete;
- status cancelado;
- auditoria obrigatória antes da remoção.

---

# 17. Segurança e Qualidade

## Segurança

- bloqueia duplicidade no registro individual;
- bloqueia alterações em diário fechado;
- permite retificação administrativa;
- pode bloquear retroatividade por ambiente;
- preserva falta justificada;
- protege mensagem técnica de erro do banco;
- usa transação no lote;
- evita auditoria concorrente dentro da transação.

## Qualidade

- lote otimizado com pré-carregamento;
- mapas evitam N+1;
- status oficial e legado são sincronizados;
- autojustificativa melhora consistência;
- diário fechado protege chamada consolidada;
- retorno do lote informa quantidade processada.

---

# 18. Pontos de Atenção

- Operações individuais e diário ainda precisam de auditoria manual explícita.
- `ehHoje()` usa UTC, não Brasília.
- `remove()` usa delete físico.
- `reabrirDiario()` tem regra efetiva diferente do controller.
- Lote não possui limite máximo de alunos no DTO.
- Auditoria em background pode falhar sem bloquear a operação.

---

# 19. Melhorias Futuras

- Auditar criação/edição/remoção individual;
- auditar fechamento e reabertura de diário;
- trocar comparação UTC por `America/Sao_Paulo`;
- padronizar roles de reabertura;
- limitar tamanho do lote;
- criar soft delete para frequência;
- criar fila para auditoria de lote;
- criar testes e2e de diário fechado, retroatividade e atestado ativo.

---

# 20. Resumo Técnico Final

As regras de lote, diário e retroatividade são o núcleo mais sensível do módulo `Frequencias`.

O fluxo em lote é bem desenhado, transacional e preserva faltas justificadas. O diário fechado protege registros consolidados, e a retroatividade pode ser controlada por ambiente.

Criticidade: muito alta.

Complexidade: muito alta.

Os principais próximos passos são auditoria completa das mutações individuais/diário, revisão de fuso horário, alinhamento de roles na reabertura e limite formal de tamanho do lote.
