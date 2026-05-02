# Documentação Técnica Completa — Braille API

> Branch analisada: `dev`  
> Escopo: backend NestJS/TypeScript da Braille API  
> Público-alvo: novos desenvolvedores, mantenedores, revisores técnicos e responsáveis por evolução do sistema.

---

## 1. Objetivo desta pasta

Esta pasta concentra a documentação profissional da API backend do projeto **Braille API**.

A intenção é permitir que qualquer pessoa desenvolvedora consiga entender:

- a arquitetura geral do backend;
- como a aplicação inicializa;
- quais módulos existem;
- quais rotas estão disponíveis;
- quais entidades existem no banco;
- como autenticação, autorização e auditoria funcionam;
- quais variáveis de ambiente são usadas;
- quais métodos principais existem em cada service;
- quais decisões técnicas foram tomadas e por quê;
- quais cuidados devem ser seguidos em manutenção futura.

Esta documentação foi escrita sem incluir valores reais de variáveis, segredos, tokens, senhas, chaves privadas ou qualquer informação sigilosa.

---

## 2. Mapa dos documentos

| Arquivo | Conteúdo |
|---|---|
| [`01-arquitetura-e-metodologia.md`](./01-arquitetura-e-metodologia.md) | Visão geral da arquitetura, metodologia, camadas, fluxo de requisição e decisões técnicas. |
| [`02-configuracao-ambiente-e-scripts.md`](./02-configuracao-ambiente-e-scripts.md) | Variáveis de ambiente, scripts NPM, configuração global, bootstrap e regras de deploy. |
| [`03-modulos-rotas-e-fluxos.md`](./03-modulos-rotas-e-fluxos.md) | Módulos do sistema, endpoints, responsabilidades e fluxos principais. |
| [`04-banco-de-dados-prisma.md`](./04-banco-de-dados-prisma.md) | Schema Prisma, entidades, enums, relacionamentos, índices e regras de persistência. |
| [`05-seguranca-auth-rbac-auditoria.md`](./05-seguranca-auth-rbac-auditoria.md) | Autenticação, refresh token, guards, RBAC, auditoria, sanitização e tratamento seguro de erros. |
| [`06-dicionario-tecnico-metodos.md`](./06-dicionario-tecnico-metodos.md) | Guia de consulta com nomes de classes, métodos, variáveis e motivos técnicos das escolhas. |
| [`07-integracoes-arquivos-certificados.md`](./07-integracoes-arquivos-certificados.md) | Cloudinary, upload, documentos, certificados, PDF, imagens e cuidados de segurança. |
| [`08-guia-de-manutencao-e-evolucao.md`](./08-guia-de-manutencao-e-evolucao.md) | Guia para próximos devs: padrões, boas práticas, riscos, testes e checklist de evolução. |

---

## 3. Como ler esta documentação

Leitura recomendada para onboarding:

1. Comece por `01-arquitetura-e-metodologia.md`.
2. Leia `02-configuracao-ambiente-e-scripts.md` antes de rodar ou publicar a API.
3. Use `03-modulos-rotas-e-fluxos.md` para entender os domínios.
4. Consulte `04-banco-de-dados-prisma.md` sempre que alterar entidades ou migrations.
5. Leia `05-seguranca-auth-rbac-auditoria.md` antes de mexer em autenticação, permissões ou logs.
6. Use `06-dicionario-tecnico-metodos.md` como guia rápido de classes, métodos e funções.
7. Consulte `07-integracoes-arquivos-certificados.md` antes de mexer em upload, Cloudinary, PDF ou certificados.
8. Use `08-guia-de-manutencao-e-evolucao.md` antes de abrir PRs grandes.

---

## 4. Escopo documentado

Esta documentação cobre os seguintes módulos e áreas técnicas:

- bootstrap da aplicação;
- módulo raiz `AppModule`;
- configuração de ambiente;
- Prisma e PostgreSQL;
- autenticação com JWT;
- refresh token com sessão persistida;
- RBAC por roles;
- usuários/staff;
- alunos/beneficiários;
- turmas, grade horária e matrículas;
- frequências/chamadas;
- atestados e justificativas;
- laudos médicos;
- comunicados;
- contatos/Fale Conosco;
- dashboard;
- configurações do site/CMS;
- apoiadores;
- modelos de certificados;
- emissão e validação pública de certificados;
- uploads no Cloudinary;
- auditoria;
- tratamento global de erros;
- scripts, build, migration e seed;
- qualidade e manutenção.

---

## 5. Informações propositalmente não documentadas

Por segurança, esta documentação **não inclui**:

- valores reais de `DATABASE_URL`;
- valores reais de `DIRECT_URL`;
- valores reais de `JWT_SECRET`;
- chaves do Cloudinary;
- tokens de produção;
- senhas padrão reais configuradas em ambiente;
- dados reais de usuários, alunos ou documentos;
- URLs privadas sensíveis;
- dumps de banco;
- arquivos médicos reais;
- certificados reais de pessoas.

Quando necessário, a documentação cita apenas o **nome da variável**, sua finalidade e o cuidado operacional esperado.

---

## 6. Metodologia usada nesta documentação

A documentação segue uma abordagem de engenharia reversa orientada por domínio:

1. **Leitura da composição raiz**: `main.ts`, `app.module.ts`, `package.json` e configuração de ambiente.
2. **Mapeamento de camadas**: controllers, services, DTOs, guards, interceptors, filters e helpers.
3. **Mapeamento de domínio**: entidades acadêmicas, administrativas, documentais e públicas.
4. **Mapeamento de persistência**: Prisma schema, enums, relacionamentos, índices e campos de controle.
5. **Mapeamento de segurança**: autenticação, RBAC, refresh tokens, CORS, validação, throttling, auditoria e sanitização.
6. **Mapeamento de integrações**: Cloudinary, ExcelJS, PDF-lib, QRCode, DOMPurify, cache e scheduler.
7. **Registro de decisões técnicas**: explicação do motivo de cada escolha importante.
8. **Guia de manutenção**: riscos, pontos de atenção e recomendações para próximos devs.

---

## 7. Convenções adotadas

| Convenção | Significado |
|---|---|
| `Controller` | Camada HTTP. Recebe request, aplica guards/decorators e chama service. |
| `Service` | Camada de regra de negócio. Executa validações, transações e integrações. |
| `DTO` | Contrato de entrada, validado por `class-validator` e `ValidationPipe`. |
| `Entity` | Representação/contrato de resposta ou entidade documentada. |
| `Prisma model` | Tabela ou estrutura persistida no banco. |
| `Soft delete` | Registro preservado, mas marcado como inativo/excluído. |
| `AuditLog` | Registro histórico de uma ação relevante. |
| `RBAC` | Controle de acesso baseado em papéis. |
| `Select cirúrgico` | Consulta Prisma retornando apenas campos necessários. |
| `Fire-and-forget` | Operação auxiliar assíncrona que não bloqueia resposta HTTP. |

---

## 8. Estado geral do backend

A Braille API é uma aplicação backend modular, com separação razoável de responsabilidades e foco em segurança institucional. O projeto já possui boas decisões técnicas, como:

- validação global de DTOs;
- CORS controlado;
- Helmet;
- compressão HTTP;
- throttling global;
- Prisma filters globais;
- auditoria global e manual;
- refresh token rotativo;
- hash de senha e hash de refresh token;
- soft delete em entidades sensíveis;
- transações em fluxos críticos;
- cache em rotas de leitura;
- upload com validação de tipo e tamanho;
- prevenção de vazamento de erro interno;
- separação clara por módulos de domínio.

Os pontos mais importantes para evolução são:

- padronizar todas as respostas HTTP;
- reduzir uso de `any` onde ainda existir;
- migrar auditoria assíncrona para fila persistente se o sistema crescer;
- usar cache distribuído caso haja múltiplas instâncias;
- ampliar testes e2e;
- remover campos legados quando a migração estiver concluída;
- manter documentação atualizada junto com cada PR.

---

## 9. Regra para manter esta documentação viva

Sempre que um PR alterar controller, service, DTO, schema Prisma, autenticação, upload, certificado, auditoria ou regra de negócio, o PR deve atualizar o documento correspondente nesta pasta.

Recomendação de checklist em PR:

```txt
[ ] Alterei regra de negócio?
[ ] Alterei rota ou payload?
[ ] Alterei entidade Prisma ou migration?
[ ] Alterei permissão/RBAC?
[ ] Alterei upload, certificado ou documento?
[ ] Alterei variável de ambiente?
[ ] Atualizei docs/api-completa?
```

---

## 10. Responsável técnico futuro

Ao assumir manutenção deste backend, leia primeiro esta pasta e depois compare com o código atual da branch. A documentação explica o desenho pretendido, mas o código deve sempre ser considerado a fonte final da verdade.
