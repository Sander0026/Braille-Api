# 36 — Beneficiaries DTOs (`src/beneficiaries/dto/`)

---

# 1. Visão Geral

## Objetivo

Documentar os DTOs do módulo `Beneficiaries`, responsáveis pelos contratos de entrada de criação, atualização, filtros e paginação de alunos/beneficiários.

Arquivos documentados:

```txt
src/beneficiaries/dto/create-beneficiary.dto.ts
src/beneficiaries/dto/update-beneficiary.dto.ts
src/beneficiaries/dto/query-beneficiary.dto.ts
```

## Responsabilidade

Os DTOs são responsáveis por:

- validar dados cadastrais do aluno;
- exigir CPF ou RG;
- validar data de nascimento;
- validar enums de deficiência, causa, acessibilidade e cor/raça;
- validar dados de contato e endereço;
- validar URLs de documentos/foto;
- validar campos LGPD;
- limitar tamanho de strings;
- normalizar strings com `trim` e remoção de byte nulo;
- validar filtros de listagem;
- limitar paginação.

---

# 2. Arquitetura e Metodologias

## Padrões Identificados

- DTO Pattern;
- Validation Pattern;
- Partial Update Pattern;
- Query Filter Pattern;
- Enum Validation Pattern;
- Input Normalization Pattern;
- LGPD-aware Contract;
- Swagger Metadata Pattern.

## Justificativa Técnica

O cadastro de alunos manipula dados pessoais e sensíveis. Os DTOs protegem a borda da aplicação, impedindo payloads malformados antes de chegarem ao service.

Com `ValidationPipe` global, os DTOs também impedem campos extras e aplicam transformação quando necessário.

---

# 3. CreateBeneficiaryDto

## Responsabilidade

Valida o cadastro manual de aluno.

Campos obrigatórios principais:

| Campo | Validação | Objetivo |
|---|---|---|
| `nomeCompleto` | `IsString`, `IsNotEmpty`, `MaxLength(200)`, `Transform(trim)` | Nome do aluno |
| `dataNascimento` | `IsDateString`, `IsNotEmpty` | Data de nascimento |
| `cpf` ou `rg` | `ValidateIf`, `IsString`, `IsNotEmpty`, `MaxLength` | Identificação única |

## Regra CPF/RG

O DTO usa `ValidateIf` para exigir ao menos um documento:

```txt
se não houver RG, CPF é obrigatório
se não houver CPF, RG é obrigatório
```

## Dados Pessoais e Endereço

Campos opcionais incluem:

- gênero;
- estado civil;
- cor/raça;
- CEP;
- rua;
- número;
- complemento;
- bairro;
- cidade;
- UF;
- ponto de referência;
- telefone;
- e-mail;
- contato de emergência.

## Dados de Deficiência e Acessibilidade

Enums usados:

| Campo | Enum |
|---|---|
| `tipoDeficiencia` | `TipoDeficiencia` |
| `causaDeficiencia` | `CausaDeficiencia` |
| `prefAcessibilidade` | `PreferenciaAcessibilidade` |
| `corRaca` | `CorRaca` |

Outros campos:

- idade de ocorrência;
- possui laudo;
- tecnologias assistivas;
- escolaridade;
- profissão;
- renda familiar;
- benefícios do governo;
- composição familiar;
- precisa acompanhante;
- acompanhamento oftalmológico;
- outras comorbidades.

## URLs e Documentos

Campos com validação de URL permissiva:

- `laudoUrl`;
- `fotoPerfil`;
- `termoLgpdUrl`;
- `atestadoUrl`.

A validação usa `IsUrl({ require_protocol: false, require_tld: false })` para compatibilidade com URLs internas/Cloudinary.

## LGPD

Campos relacionados:

- `termoLgpdAceito`;
- `termoLgpdAceitoEm`;
- `termoLgpdUrl`.

---

# 4. UpdateBeneficiaryDto

## Responsabilidade

Permitir atualização parcial de aluno.

Implementação:

```txt
UpdateBeneficiaryDto extends PartialType(CreateBeneficiaryDto)
```

Isso significa que todos os campos de criação ficam opcionais na atualização.

Benefícios:

- reduz duplicação;
- mantém validações da criação;
- permite PATCH parcial;
- centraliza contrato base em `CreateBeneficiaryDto`.

---

# 5. QueryBeneficiaryDto

## Responsabilidade

Validar filtros e paginação usados em:

- `GET /beneficiaries`;
- `GET /beneficiaries/export`.

Campos de paginação:

| Campo | Validação | Padrão |
|---|---|---|
| `page` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(10000)` | `1` |
| `limit` | `Type(Number)`, `IsInt`, `Min(1)`, `Max(100)` | `10` |

Filtros principais:

- `busca`;
- `nome` legado;
- `inativos`;
- `tipoDeficiencia`;
- `causaDeficiencia`;
- `prefAcessibilidade`;
- `precisaAcompanhante`;
- `genero`;
- `corRaca`;
- `estadoCivil`;
- `cidade`;
- `uf`;
- `escolaridade`;
- `rendaFamiliar`;
- `dataCadastroInicio`;
- `dataCadastroFim`.

## Transformações

`precisaAcompanhante` converte:

```txt
"true"  → true
"false" → false
outros valores → undefined
```

`inativos` usa `Type(() => Boolean)`.

---

# 6. Dicionário Técnico

## Classes

| Classe | Responsabilidade |
|---|---|
| `CreateBeneficiaryDto` | Validar cadastro de aluno |
| `UpdateBeneficiaryDto` | Validar atualização parcial |
| `QueryBeneficiaryDto` | Validar filtros e paginação |

## Funções Auxiliares

| Função | Objetivo |
|---|---|
| `trim` | Remove byte nulo e espaços extras em strings |

## Dependências

| Dependência | Uso |
|---|---|
| `class-validator` | Validações declarativas |
| `class-transformer` | Transformações de entrada |
| `@nestjs/swagger` | Documentação OpenAPI |
| `@prisma/client` | Enums do domínio |
| `PartialType` | Atualização parcial |

---

# 7. Segurança e Qualidade

## Segurança

Pontos fortes:

- exige CPF ou RG;
- limita tamanhos de campos textuais;
- remove byte nulo de strings principais;
- valida e-mail;
- valida datas ISO;
- valida enums;
- limita paginação;
- valida URLs de documentos;
- rejeita campos extras via `ValidationPipe` global.

## Qualidade

Pontos positivos:

- DTOs coesos;
- uso de `PartialType`;
- validações claras;
- Swagger integrado;
- filtros reutilizados por listagem e exportação;
- compatibilidade com campos legados como `nome`.

---

# 8. Pontos de Atenção

- `IsUrl` é permissivo para Cloudinary/URLs internas; regras de domínio devem ser reforçadas no upload/service.
- `cpf` e `rg` têm validação estrutural básica; validação matemática de CPF pode ser melhoria futura.
- `Type(() => Boolean)` em query pode ter comportamento menos explícito do que `Transform` manual.
- `UpdateBeneficiaryDto` herda todos os campos, o que é prático, mas pode permitir atualização de campos que futuramente deveriam ter fluxo próprio.

---

# 9. Melhorias Futuras

- Criar validator customizado de CPF;
- criar validator de RG se houver regra institucional;
- restringir domínios de URL de documentos;
- criar DTO específico para upload/alteração de documentos;
- criar DTO específico para LGPD;
- revisar conversão booleana de `inativos`;
- criar enum interno para campos de busca avançada.

---

# 10. Resumo Técnico Final

Os DTOs de `Beneficiaries` são robustos e adequados à criticidade do domínio.

Eles validam dados pessoais, documentos, LGPD, acessibilidade, filtros e paginação, além de normalizar strings e limitar campos.

Criticidade: alta.

Complexidade: alta.

A implementação está profissional. Os principais próximos passos são validação customizada de CPF/RG, políticas mais rígidas para URLs e DTOs específicos para fluxos sensíveis como documentos e LGPD.
