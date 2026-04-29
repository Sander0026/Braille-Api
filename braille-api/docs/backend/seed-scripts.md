# Modulo: Seeds e Scripts

---

# 1. Visao Geral

## Objetivo

Documentar `prisma/seed*` e `scripts/*`, responsaveis por populacao inicial, dados de alunos e manutencao de matriculas.

## Responsabilidade

Criar usuario administrador inicial, configurar conteudo padrao do site, importar/popular alunos de exemplo e executar rotinas auxiliares de backfill/teste.

## Fluxo de Funcionamento

O `package.json` define `prisma.seed` como `ts-node prisma/seed/index.ts`. O seed orquestra seeders especializados. Scripts em `scripts` executam tarefas manuais como backfill de matriculas e contagem/testes.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Script Runner.
* Seeder Pattern.
* Idempotencia parcial por verificacao/criacao.
* Helper compartilhado de matricula.

## Justificativa Tecnica

Separar seeders por dominio evita um seed monolitico e facilita reexecucao controlada. Scripts de backfill corrigem dados legados sem misturar logica temporaria no runtime da API.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `prisma/seed/index.ts` instancia Prisma e chama seeders.
2. `admin-seeder.ts` cria usuario administrativo com senha hash.
3. `site-config-seeder.ts` grava configuracoes/conteudo padrao.
4. `alunos-seeder.ts` popula alunos com dados estruturados.
5. `scripts/backfill-matriculas.ts` corrige registros sem matricula.
6. `scripts/lib/matricula-generator.ts` encapsula geracao para scripts.

## Dependencias Internas

* Prisma Client.
* Helpers de matricula.
* Schema Prisma.

## Dependencias Externas

* `ts-node`
* `bcrypt`
* `@prisma/client`

---

# 4. Dicionario Tecnico

## Variaveis

* `prisma`: instancia Prisma usada pelo script.
* `senhaHash`: senha inicial com bcrypt.
* `matricula`: identificador institucional gerado.
* `prefix`: ano corrente para alunos ou `P` + ano para staff.

## Funcoes e Metodos

* Seed admin: cria usuario inicial.
* Seed alunos: insere massa de alunos.
* Seed site config: insere defaults.
* Backfill matriculas: percorre registros legados e atribui matricula.
* Matricula generator: calcula proximo sequencial.

## Classes

Scripts nao definem classes principais; sao arquivos executaveis.

## Interfaces e Tipagens

Usam tipos Prisma gerados a partir do schema.

---

# 5. Servicos e Integracoes

## APIs

Nao expoe endpoints HTTP.

## Banco de Dados

Escreve em `User`, `Aluno`, `SiteConfig`, `ConteudoSecao` e possivelmente outros conforme seed.

## Servicos Externos

Nao ha integracoes externas principais.

---

# 6. Seguranca e Qualidade

## Seguranca

* Senhas devem ser hashadas com bcrypt.
* Seeds nao devem expor credenciais reais em repositorio.
* Scripts de manutencao devem ser executados com cuidado em producao.

## Qualidade

* Separacao por seeder melhora rastreabilidade.
* Backfill fora do runtime evita regra temporaria na API.

## Performance

* Seeds grandes devem preferir `createMany`.
* Backfills devem paginar em bases grandes.

---

# 7. Regras de Negocio

* Admin inicial precisa existir para operar o painel.
* Conteudo padrao do site garante frontend funcional.
* Alunos devem ter matricula unica.
* Backfill deve preservar matriculas existentes.

---

# 8. Pontos de Atencao

* Rodar seed em producao pode sobrescrever dados se nao for idempotente.
* Scripts devem ser revisados antes de executar em bancos reais.
* Credenciais padrao devem ser trocadas imediatamente.

---

# 9. Relacao com Outros Modulos

* Alimenta `Auth/Users`.
* Alimenta `Beneficiaries`.
* Alimenta `SiteConfig`.
* Usa mesma regra de matricula documentada em `Common`.

---

# 10. Resumo Tecnico Final

Seeds e scripts sao suporte operacional de criticidade media. Eles nao fazem parte do caminho HTTP, mas impactam dados iniciais e integridade historica. A complexidade e media por lidar com dados legados e configuracao inicial.

