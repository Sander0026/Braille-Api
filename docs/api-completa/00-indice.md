# Documentação Técnica Completa — Braille API

---

## 1. Objetivo desta documentação

Esta pasta contém a documentação técnica profissional da **Braille API**, criada para orientar novos desenvolvedores, mantenedores, revisores técnicos e futuros responsáveis pela evolução do sistema.

O objetivo é explicar **como o backend funciona**, **por que foi estruturado dessa forma**, **quais módulos existem**, **quais variáveis e métodos são importantes**, **como os dados trafegam**, **quais regras de negócio existem** e **quais cuidados devem ser tomados em manutenção futura**.

Esta documentação evita registrar valores sigilosos. São documentados apenas nomes de variáveis, responsabilidades, padrões, fluxos e boas práticas.

---

## 2. Estrutura da documentação

| Arquivo | Conteúdo |
|---|---|
| `00-indice.md` | Índice geral da documentação. |
| `01-visao-geral-e-arquitetura.md` | Visão geral técnica, arquitetura, metodologia e padrões usados. |
| `02-guia-de-ambiente-variaveis-e-scripts.md` | Variáveis de ambiente, scripts NPM, build, banco e execução local. |
| `03-modulos-dominios-e-responsabilidades.md` | Guia completo dos módulos da API e responsabilidades de cada domínio. |
| `04-rotas-e-contratos-da-api.md` | Mapa de rotas, permissões, payloads conceituais e respostas esperadas. |
| `05-banco-de-dados-prisma.md` | Entidades Prisma, relacionamentos, enums, índices e decisões de modelagem. |
| `06-autenticacao-seguranca-e-auditoria.md` | JWT, refresh token, RBAC, guards, throttling, CORS, Helmet e auditoria. |
| `07-guia-de-metodos-variaveis-e-nomes.md` | Dicionário de métodos, variáveis, constantes, services e nomenclaturas. |
| `08-regras-de-negocio-e-fluxos.md` | Regras funcionais e fluxos críticos por domínio. |
| `09-guia-para-novos-desenvolvedores.md` | Guia de onboarding, boas práticas, padrões e pontos de atenção. |

---

## 3. Como usar esta documentação

Para entender o sistema rapidamente, leia nesta ordem:

1. `01-visao-geral-e-arquitetura.md`
2. `03-modulos-dominios-e-responsabilidades.md`
3. `04-rotas-e-contratos-da-api.md`
4. `05-banco-de-dados-prisma.md`
5. `06-autenticacao-seguranca-e-auditoria.md`
6. `07-guia-de-metodos-variaveis-e-nomes.md`
7. `08-regras-de-negocio-e-fluxos.md`
8. `09-guia-para-novos-desenvolvedores.md`

---

## 4. Escopo documentado

Esta documentação cobre:

- bootstrap da aplicação;
- configuração global do NestJS;
- arquitetura modular;
- autenticação e autorização;
- usuários internos;
- alunos/beneficiários;
- turmas e matrículas;
- frequências e diário;
- atestados;
- laudos médicos;
- upload de arquivos;
- certificados;
- apoiadores;
- comunicados;
- contatos;
- dashboard;
- site-config/CMS;
- auditoria;
- banco de dados;
- integrações externas;
- variáveis de ambiente;
- scripts de execução;
- regras de negócio;
- riscos e melhorias futuras.

---

## 5. Premissas técnicas

A análise considera a branch `dev` do repositório `Sander0026/Braille-Api`.

Tecnologias principais identificadas:

- Node.js;
- TypeScript;
- NestJS;
- Prisma ORM;
- PostgreSQL;
- JWT;
- bcrypt;
- Cloudinary;
- ExcelJS;
- PDF-lib;
- cache-manager;
- NestJS Throttler;
- Swagger/OpenAPI;
- Jest;
- ESLint;
- Prettier.

---

## 6. Convenções usadas nesta documentação

| Termo | Significado |
|---|---|
| `Controller` | Camada HTTP responsável por expor endpoints. |
| `Service` | Camada de regra de negócio. |
| `DTO` | Objeto de entrada validado com `class-validator`. |
| `Entity` | Representação conceitual de resposta/modelo. |
| `Prisma Model` | Tabela/modelo persistido no banco. |
| `Guard` | Componente de autorização/autenticação. |
| `Interceptor` | Componente transversal executado antes/depois das rotas. |
| `Filter` | Tratamento global de exceções. |
| `Soft delete` | Exclusão lógica, preservando dados no banco. |
| `RBAC` | Controle de acesso baseado em papéis. |

---

## 7. Observação sobre dados sensíveis

Esta documentação **não inclui valores reais** de variáveis de ambiente, credenciais, secrets, URLs privadas, tokens, senhas ou chaves externas.

São documentados apenas:

- nomes das variáveis;
- finalidade;
- obrigatoriedade;
- impacto técnico;
- cuidados de uso.
