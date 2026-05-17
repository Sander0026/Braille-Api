# Modulo: Relatorios

---

# 1. Visao Geral

## Objetivo

Consolidar dados institucionais do ILBES para gestao interna, acompanhamento pedagogico,
prevencao de evasao e prestacao de contas para apoiadores, governo e comunicacao.

O modulo evita que a tela de relatorios dependa de consultas grandes e genericas. Em vez disso,
ele oferece endpoints menores, agregados e carregados por demanda pelo frontend.

## Responsabilidade

O backend e responsavel por:

- aplicar filtros institucionais de forma consistente;
- montar indicadores agregados de alunos, turmas, matriculas, evasoes, frequencias e atendimentos;
- gerar rankings limitados para dashboards;
- expor lista paginada de alunos;
- identificar alunos com risco de evasao;
- calcular impacto social e comparativo com periodo anterior;
- separar exportacao publica/agregada em PDF da exportacao interna/detalhada em XLSX;
- registrar auditoria nas exportacoes.

---

# 2. Onde Fica Cada Coisa

| Area | Arquivo | Papel |
|---|---|---|
| Modulo Nest | `src/relatorios/relatorios.module.ts` | Registra controller, service e exporters |
| Rotas HTTP | `src/relatorios/relatorios.controller.ts` | Define endpoints, RBAC e response de arquivos |
| Regras e consultas | `src/relatorios/relatorios.service.ts` | Monta filtros Prisma, agregacoes e relatorios |
| DTO base | `src/relatorios/dto/filtro-relatorio-geral.dto.ts` | Contrato compartilhado de filtros |
| DTOs especificos | `src/relatorios/dto/filtro-relatorio-*.dto.ts` | Extensoes por dominio |
| PDF institucional | `src/relatorios/exporters/relatorio-institucional-pdf.service.ts` | Exportacao publica/agregada |
| XLSX interno | `src/relatorios/exporters/relatorio-institucional-xlsx.service.ts` | Exportacao detalhada para uso interno |
| Testes do service | `src/relatorios/relatorios.service.spec.ts` | Consultas, filtros, exportacoes, risco e impacto |
| Testes do controller | `src/relatorios/relatorios.controller.spec.ts` | Permissoes das exportacoes |

Modelos Prisma mais usados:

- `Aluno`
- `Turma`
- `MatriculaOficina`
- `Frequencia`
- `AtendimentoIndividual`
- `CertificadoEmitido`
- `User`

---

# 3. Acesso e Auditoria

## RBAC

O controller usa `@UseGuards(AuthGuard, RolesGuard)` e tem `@Roles(Role.ADMIN, Role.SECRETARIA)`
como regra padrao.

Excecoes:

- `POST /relatorios/exportar/pdf`: permitido para `ADMIN`, `SECRETARIA` e `COMUNICACAO`.
- `POST /relatorios/exportar/xlsx`: permitido apenas para `ADMIN` e `SECRETARIA`.

Motivo: o PDF e publico/institucional e retorna apenas dados agregados. O XLSX pode conter dados
detalhados e deve ficar restrito a perfis administrativos.

## Auditoria

O controller tem `@SkipAudit()` porque endpoints de leitura nao devem gerar ruido no audit log.
As exportacoes registram auditoria manualmente dentro do service:

- `exportarPdf(...)`
- `exportarXlsx(...)`

Se adicionar uma nova exportacao, registre auditoria explicitamente.

---

# 4. Contrato de Filtros

O filtro comum fica em `FiltroRelatorioGeralDto`.

| Campo | Uso |
|---|---|
| `dataInicio` / `dataFim` | Recorta periodo por data do dominio de cada relatorio |
| `turmaId` | Filtra por turma especifica |
| `professorId` | Filtra por professor |
| `alunoId` | Filtra por aluno |
| `statusAluno` | `ATIVO`, `INATIVO` ou `TODOS` |
| `statusTurma` | `PREVISTA`, `ANDAMENTO`, `CONCLUIDA`, `CANCELADA` |
| `statusMatricula` | `ATIVA`, `CONCLUIDA`, `EVADIDA`, `CANCELADA`, `TRANSFERIDA` |
| `motivoEncerramento` | Motivo estruturado em `MatriculaOficina` |
| `cidade` / `bairro` | Localidade normalizada via autocomplete no frontend |
| `tipoDeficiencia` | Recorte por tipo de deficiencia |

Principio importante: filtros devem ser aplicados no banco sempre que possivel. Evite buscar tudo
para filtrar em memoria, principalmente em alunos, frequencias e atendimentos.

---

# 5. Endpoints

Base: `/api/relatorios`

| Metodo | Rota | Uso principal |
|---|---|---|
| `GET` | `/resumo` | Cards gerais da aba Visao Geral |
| `GET` | `/alunos/resumo` | Contagens leves da aba Alunos |
| `GET` | `/alunos/distribuicoes` | Rankings Top 10 da aba Alunos |
| `GET` | `/alunos/lista?page=1&limit=20` | Lista paginada de alunos |
| `GET` | `/alunos` | Relatorio legado/detalhado, usado em exportacao interna |
| `GET` | `/turmas` | Relatorio detalhado de turmas |
| `GET` | `/evasoes` | Encerramentos, evasoes, cancelamentos e transferencias |
| `GET` | `/risco-evasao` | Alunos priorizados para busca ativa |
| `GET` | `/impacto-social` | Indicadores agregados e comparativo com periodo anterior |
| `GET` | `/atendimentos` | Relatorio de atendimentos individuais legado |
| `GET` | `/frequencias` | Relatorio de frequencias |
| `GET` | `/opcoes/turmas?busca=...` | Autocomplete de turmas |
| `GET` | `/opcoes/professores?busca=...` | Autocomplete de professores |
| `GET` | `/opcoes/alunos?busca=...` | Autocomplete de alunos |
| `GET` | `/opcoes/cidades?busca=...` | Autocomplete de cidades cadastradas |
| `GET` | `/opcoes/bairros?busca=...&cidade=...` | Autocomplete de bairros |
| `POST` | `/exportar/pdf` | PDF publico/institucional, agregado |
| `POST` | `/exportar/xlsx` | XLSX interno/detalhado |

---

# 6. Decisoes de Performance

## Carregamento por aba

O backend foi separado em endpoints menores para permitir que o frontend carregue somente a aba
aberta pelo usuario. Isso evita que `/admin/relatorios` chame alunos, turmas, evasoes,
atendimentos e frequencias de uma vez.

## Alunos em tres partes

A aba Alunos foi dividida em:

1. `alunosResumo`: apenas contagens.
2. `alunosDistribuicoes`: rankings limitados.
3. `alunosLista`: dados paginados.

Motivo: alunos tem muitos campos e relacoes. Um `findMany` sem paginacao trava navegador e pesa no
banco quando existem muitos registros.

## Autocomplete sob demanda

Os endpoints de opcoes retornam vazio quando `busca` tem menos de 2 caracteres. Eles tambem usam
`take: 20`.

Motivo: evitar carregar centenas de alunos, turmas ou professores so para montar selects.

## PDF leve, XLSX detalhado

O PDF usa `gerarConsolidadoInstitucional`, que busca apenas dados agregados:

- resumo geral;
- Top 10 cidades;
- Top 10 motivos de evasao;
- Top 10 turmas por evasao;
- totais de atendimentos e frequencias;
- taxas principais;
- impacto social agregado.

O XLSX usa `gerarConsolidado` com limite de detalhes (`LIMITE_EXPORTACAO_XLSX_DETALHADA = 5000`).

Motivo: PDF e para comunicacao externa; XLSX e para analise interna. O PDF nao deve vazar dados
sensiveis e nao deve carregar tabelas gigantes.

---

# 7. Fluxos Principais

## 7.1 Resumo Geral

Metodo: `resumo(filtro, authUser)`

Calcula totais de alunos, turmas e matriculas, alem de:

- taxa de evasao;
- taxa de conclusao;
- taxa de permanencia.

E usado na aba Visao Geral e tambem como base para impacto social e PDF institucional.

## 7.2 Alunos

Metodos:

- `alunosResumo(...)`
- `alunosDistribuicoes(...)`
- `alunosLista(...)`
- `alunos(...)` legado/detalhado

`alunosLista` normaliza `page` e `limit`:

- padrao: `page = 1`, `limit = 20`;
- maximo: `limit = 50`.

Se precisar adicionar um novo agrupamento, prefira incluir em `alunosDistribuicoes` com ranking
limitado, nao no endpoint paginado.

## 7.3 Evasoes

Metodo: `evasoes(filtro, authUser)`

Considera matriculas encerradas por status:

- `EVADIDA`
- `CANCELADA`
- `TRANSFERIDA`

O relatorio preserva detalhes importantes para analise interna, como motivo de encerramento,
tempo de permanencia e relacao com atendimentos individuais.

## 7.4 Risco de Evasao

Metodo: `riscoEvasao(filtro, authUser)`

Objetivo: apontar alunos que precisam de busca ativa antes de evadir.

Regras atuais:

- 3 faltas seguidas;
- presenca abaixo de 60%;
- sem atendimento/frequencia ha mais de 30 dias;
- matricula ativa sem frequencia recente.

Recortes importantes:

- considera somente matriculas `ATIVA`;
- considera somente alunos ativos e nao excluidos;
- considera somente turmas `PREVISTA` ou `ANDAMENTO`;
- olha uma janela recente de frequencias e atendimentos;
- limita a quantidade de matriculas avaliadas e itens retornados.

O resultado possui:

- `indicadores`: contagens por nivel e criterio;
- `data`: lista priorizada por nivel de risco e quantidade de criterios.

Se alterar criterios, atualize tambem:

- `RelatorioRiscoEvasaoItem`;
- testes em `relatorios.service.spec.ts`;
- componente frontend `relatorio-evasoes`.

## 7.5 Impacto Social

Metodo: `impactoSocial(filtro, authUser)`

Calcula:

- total de alunos atendidos no periodo;
- total de atendimentos individuais;
- total de turmas ofertadas;
- total de certificados emitidos;
- total de alunos com deficiencia visual atendidos;
- total de cidades e bairros alcancados;
- taxa de permanencia;
- taxa de conclusao.

Tambem calcula o periodo anterior com a mesma duracao do periodo atual e retorna um comparativo:

```ts
{
  atual: number;
  anterior: number;
  variacaoPercentual: number;
  direcao: 'SUBIU' | 'DESCEU' | 'ESTAVEL';
}
```

Motivo: a instituicao precisa mostrar evolucao, nao apenas numeros absolutos.

## 7.6 Exportacao PDF

Metodo: `exportarPdf(...)`

Usa:

- `filtroExportacaoPdf(...)`;
- `gerarConsolidadoInstitucional(...)`;
- `RelatorioInstitucionalPdfService`.

O PDF deve continuar sendo agregado e publico. Nao inclua:

- CPF;
- RG;
- endereco completo;
- observacoes sensiveis;
- listas nominais de alunos;
- dados livres de acompanhamento.

## 7.7 Exportacao XLSX

Metodo: `exportarXlsx(...)`

Usa:

- `gerarConsolidado(...)`;
- `RelatorioInstitucionalXlsxService`.

Pode conter dados detalhados, mas deve permanecer restrito a `ADMIN` e `SECRETARIA`.

---

# 8. Helpers Importantes no Service

| Helper | Responsabilidade |
|---|---|
| `validarPeriodo` | Garante coerencia entre `dataInicio` e `dataFim` |
| `obterPeriodo` / `montarRange` | Converte datas do filtro para range Prisma |
| `montarWhereAluno` | Filtro completo de aluno para relatorios |
| `montarWhereAlunoBasico` | Filtro de aluno para joins e agregacoes |
| `montarWhereTurma` | Filtro de turma e professor |
| `montarWhereMatricula` | Filtro central de matriculas |
| `montarWhereFrequencia` | Filtro central de frequencias |
| `montarWhereAtendimento` | Filtro central de atendimentos |
| `combinarWhereAluno` / `combinarWhereTurma` / `combinarWhereMatricula` | Compoe filtros com `AND` sem sobrescrever regras |
| `rankingAlunosPorCampo` | Ranking Top 10 por campo de aluno |
| `periodoAtualEAnterior` | Base do comparativo do impacto social |
| `compararMetricas` | Monta variacao percentual e direcao |

Ao adicionar filtros, atualize os builders `montarWhere*` primeiro. Isso reduz divergencia entre
abas, exportacoes e rankings.

---

# 9. Como Evoluir com Seguranca

## Adicionar uma nova metrica agregada

1. Adicione o campo no tipo retornado em `relatorios.service.ts`.
2. Calcule a metrica no metodo correto.
3. Atualize testes do service.
4. Atualize a interface no frontend.
5. Atualize o componente visual que consome o dado.
6. Se entrar no PDF, garanta que seja agregado e nao sensivel.

## Adicionar um novo filtro

1. Inclua o campo em `FiltroRelatorioGeralDto`.
2. Aplique em `montarWhereAlunoBasico`, `montarWhereTurma`, `montarWhereMatricula`,
   `montarWhereFrequencia` ou `montarWhereAtendimento`, conforme o dominio.
3. Atualize `RELATORIO_INSTITUCIONAL_KEYS` no frontend.
4. Atualize `RelatorioFiltro` no frontend.
5. Adicione ou ajuste testes.

## Adicionar uma nova aba no frontend

1. Crie um endpoint leve aqui na API.
2. Evite acoplar a nova aba em `gerarConsolidado`.
3. Adicione cache/carregamento por aba no frontend.
4. Teste que a aba nao e carregada antes de ser aberta.

---

# 10. Testes Recomendados

Para validar este modulo:

```bash
npm test -- relatorios.service.spec.ts relatorios.controller.spec.ts --runInBand
```

Para validar compilacao:

```bash
npm run build
```

Cenarios que precisam permanecer cobertos:

- opcoes/autocomplete nao buscam com termo curto;
- alunos resumo/distribuicoes/lista continuam separados;
- lista de alunos respeita paginacao e limite maximo;
- PDF usa consolidado institucional leve;
- XLSX usa consolidado detalhado com limite;
- risco de evasao identifica criterios corretamente;
- impacto social calcula periodo anterior e comparativo;
- `COMUNICACAO` pode PDF mas nao XLSX.

---

# 11. Pontos de Atencao

- Nao volte a carregar todos os relatorios no carregamento inicial da tela.
- Nao use `statusAtivo` como regra academica de conflito, matricula ou chamada; use `TurmaStatus`
  quando a regra for academica.
- Nao exponha dados sensiveis no PDF institucional.
- Nao transforme autocomplete em select carregado automaticamente.
- Nao remova o limite da exportacao XLSX sem discutir streaming/paginacao.
- Ao mexer em risco de evasao, valide ordenacao e criterios com dados reais de frequencia.
