# 22 — Common: SanitizeHtmlPipe (`src/common/pipes/sanitize-html.pipe.ts`)

---

# 1. Visão Geral

## Objetivo

Documentar o `SanitizeHtmlPipe`, pipe responsável por sanitizar conteúdo HTML recebido no corpo das requisições.

Esse pipe é usado principalmente em rotas que aceitam conteúdo editável, como comunicados e CMS do site institucional.

## Responsabilidade

O `SanitizeHtmlPipe` é responsável por:

- sanitizar strings HTML em payloads do tipo `body`;
- remover tags e atributos não permitidos;
- preservar HTML seguro necessário para conteúdo institucional;
- processar objetos e arrays de forma recursiva;
- tratar strings que contenham JSON válido;
- reduzir risco de XSS persistente;
- evitar criar uma instância nova de JSDOM/DOMPurify por requisição.

## Fluxo de Funcionamento

```txt
Request com body
  ↓
SanitizeHtmlPipe.transform()
  ↓
Verifica metadata.type === 'body'
  ↓
sanitizeRecursively(value)
  ↓
String → DOMPurify
Array → sanitiza cada item
Objeto → sanitiza cada campo
  ↓
Body sanitizado segue para controller/service
```

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- Pipe Pattern;
- Input Sanitization;
- Recursive Data Processing;
- Singleton Resource Pattern;
- Defense Against Stored XSS;
- Server-side DOMPurify Pattern.

## Justificativa Técnica

Rotas de conteúdo como comunicados e CMS podem receber HTML que será renderizado no frontend.

Sem sanitização, um usuário autorizado poderia inserir scripts, atributos perigosos ou HTML malicioso que seria exibido posteriormente para visitantes do site.

O pipe reduz esse risco removendo elementos não permitidos antes de persistir ou processar o conteúdo.

---

# 3. Fluxo Interno do Código

## DOMPurify com JSDOM

O backend não possui DOM nativo como um navegador. Por isso, o pipe cria uma janela com `JSDOM` e inicializa DOMPurify usando essa janela.

A instância é criada uma única vez no módulo:

```txt
const { window } = new JSDOM('')
const purify = createDOMPurify(window)
```

Essa decisão evita overhead de criar DOMPurify/JSDOM a cada requisição.

## Tags Permitidas

`ALLOWED_TAGS` define quais elementos HTML podem permanecer.

Exemplos:

- `b`;
- `i`;
- `em`;
- `strong`;
- `a`;
- `p`;
- `br`;
- `ul`;
- `ol`;
- `li`;
- headings `h1` a `h6`;
- `span`;
- `div`;
- `img`;
- `blockquote`;
- `code`;
- `pre`.

## Atributos Permitidos

`ALLOWED_ATTR` define atributos aceitos.

Lista principal:

- `href`;
- `target`;
- `src`;
- `alt`;
- `class`;
- `style`;
- `rel`;
- `data-list`.

## Método `transform()`

Responsabilidade:

- receber `value` e `metadata`;
- sanitizar somente quando `metadata.type === 'body'`;
- retornar query/param sem alteração;
- delegar processamento para `sanitizeRecursively()`.

## `sanitizeRecursively()`

Responsabilidade:

- sanitizar string;
- mapear arrays;
- sanitizar objetos literais;
- retornar valores primitivos sem alteração.

## `sanitizeString()`

Responsabilidade:

- tentar interpretar a string como JSON;
- se for objeto/array JSON válido, sanitizar estrutura interna e serializar de volta;
- se não for JSON, aplicar `purify.sanitize()` diretamente.

## `isPlainObject()`

Type guard para identificar objetos literais simples, ignorando `null` e arrays.

## `sanitizeObject()`

Cria novo objeto sanitizado campo a campo.

---

# 4. Dicionário Técnico

## Constantes

| Nome | Objetivo |
|---|---|
| `createDOMPurify` | Compatibilizar import CommonJS/ESM do DOMPurify |
| `window` | Janela JSDOM usada pelo DOMPurify |
| `purify` | Instância singleton do DOMPurify |
| `ALLOWED_TAGS` | Lista de tags HTML permitidas |
| `ALLOWED_ATTR` | Lista de atributos permitidos |

## Funções e Métodos

| Função/Método | Objetivo |
|---|---|
| `transform()` | Sanitizar body da requisição |
| `sanitizeRecursively()` | Sanitizar string, array ou objeto |
| `isPlainObject()` | Identificar objeto literal |
| `sanitizeObject()` | Sanitizar cada campo de um objeto |
| `sanitizeString()` | Sanitizar HTML ou JSON serializado |

## Classe

| Classe | Responsabilidade |
|---|---|
| `SanitizeHtmlPipe` | Sanitizar payloads HTML no body |

---

# 5. Serviços e Integrações

## APIs

O pipe é aplicado em rotas que aceitam HTML editável.

Exemplos de uso:

- criação/edição de comunicados;
- atualização de configurações do site;
- atualização de seções do CMS.

## Banco de Dados

O pipe não acessa banco diretamente.

Ele sanitiza dados antes que services persistam o conteúdo.

## Serviços Externos

Integrações técnicas:

| Dependência | Uso |
|---|---|
| `dompurify` | Sanitização HTML |
| `jsdom` | DOM server-side para DOMPurify |
| `@nestjs/common` | Contrato `PipeTransform` e `Injectable` |

---

# 6. Segurança e Qualidade

## Segurança

Pontos fortes:

- remove HTML não permitido;
- sanitiza objetos aninhados;
- sanitiza arrays;
- processa strings JSON válidas;
- atua somente em `body`, evitando interferência em params/query;
- reduz risco de XSS persistente.

## Qualidade

Pontos positivos:

- funções puras fora da classe;
- melhor testabilidade;
- DOMPurify singleton;
- listas explícitas de tags e atributos;
- responsabilidade clara e isolada.

## Performance

A instância de JSDOM/DOMPurify é singleton, evitando criação por requisição.

A sanitização recursiva tem custo proporcional ao tamanho do payload.

---

# 7. Regras de Negócio Transversais

- conteúdo HTML editável deve ser sanitizado antes de persistência;
- somente tags e atributos permitidos podem sobreviver;
- queries e params não são alterados por esse pipe;
- strings JSON são sanitizadas internamente quando representam objeto ou array;
- o pipe deve ser usado em rotas de CMS, comunicados ou campos ricos.

---

# 8. Pontos de Atenção

## Riscos

- O atributo `style` é permitido. Isso pode ser necessário para o editor visual, mas deve ser monitorado.
- Tags `img` e atributos `src` são permitidos; URLs externas devem ser controladas por regra de negócio quando necessário.
- Sanitização não substitui validação de domínio nos DTOs/services.
- DOMPurify remove HTML perigoso, mas o frontend também deve renderizar conteúdo com cuidado.

## Débitos Técnicos

- Criar testes unitários com payloads XSS comuns.
- Revisar se `style` deve continuar permitido.
- Restringir protocolos permitidos em `href` e `src`, se necessário.
- Documentar política oficial de HTML permitido no CMS.

## Melhorias Futuras

- Criar configuração por tipo de conteúdo.
- Criar pipe específico para CMS com política mais restrita.
- Adicionar testes de regressão de sanitização.
- Padronizar uso do pipe nos controllers de conteúdo.

---

# 9. Relação com Outros Módulos

| Módulo | Relação |
|---|---|
| `ComunicadosController` | Usa o pipe em criação/edição |
| `SiteConfigController` | Usa o pipe em atualização de configurações/seções |
| Frontend | Renderiza conteúdo sanitizado |
| DTOs | Validam formato antes/depois do pipe conforme ordem de execução |
| Services | Persistem conteúdo já sanitizado |

---

# 10. Resumo Técnico Final

O `SanitizeHtmlPipe` é uma camada importante de segurança para conteúdo institucional editável.

Ele usa DOMPurify com JSDOM, sanitiza de forma recursiva, permite HTML controlado e reduz risco de XSS persistente.

Criticidade: alta.

Complexidade: média.

A implementação está profissional, especialmente pelo uso singleton do DOMPurify. Os principais pontos de atenção são a permissão de `style`, `img/src` e a necessidade de testes unitários com payloads maliciosos.
