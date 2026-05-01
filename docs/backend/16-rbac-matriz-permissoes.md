# 16 — RBAC: Matriz de Permissões

---

# 1. Visão Geral

Este documento registra a matriz de permissões por perfil da Braille API.

| Role | Responsabilidade |
|---|---|
| `ADMIN` | Administração total do sistema |
| `SECRETARIA` | Operação acadêmica e administrativa |
| `PROFESSOR` | Operação pedagógica e chamadas |
| `COMUNICACAO` | Conteúdo institucional, comunicados e CMS |

Fluxo de autorização:

```txt
AuthGuard valida JWT e usuário ativo
  ↓
RolesGuard lê @Roles()
  ↓
Compara req.user.role
  ↓
Permite ou bloqueia acesso
```

---

# 2. Matriz Macro

| Domínio | ADMIN | SECRETARIA | PROFESSOR | COMUNICACAO | Observação |
|---|---:|---:|---:|---:|---|
| Auth login/refresh | Público | Público | Público | Público | Não exige access token |
| Auth perfil/logout | Sim | Sim | Sim | Sim | Exige JWT |
| Users | Sim | Não | Não | Não | CRUD de usuários somente ADMIN |
| Dashboard | Sim | Sim | Sim | Sim | Todos internos |
| Beneficiaries leitura | Sim | Sim | Sim | Sim | Rotas autenticadas sem role específica |
| Beneficiaries escrita/import/export | Sim | Sim | Não | Não | ADMIN e SECRETARIA |
| Turmas leitura | Sim | Sim | Sim | Não | ADMIN, SECRETARIA e PROFESSOR |
| Turmas escrita/matrícula/status | Sim | Sim | Não | Não | ADMIN e SECRETARIA |
| Frequências registrar/listar/editar | Sim | Sim | Sim | Não | ADMIN, SECRETARIA e PROFESSOR |
| Frequências deletar/reabrir diário | Sim | Sim | Não | Não | Professor não deleta nem reabre |
| Atestados delete | Sim | Sim | Não | Não | ADMIN e SECRETARIA |
| Laudos criar/editar/remover | Sim | Sim | Não | Não | ADMIN e SECRETARIA |
| Laudos listar | Sim | Sim | Sim | Não | Professor pode consultar |
| Comunicados leitura | Público | Público | Público | Público | Público/cacheado |
| Comunicados gestão | Sim | Não | Não | Sim | ADMIN e COMUNICACAO |
| Upload institucional | Sim | Não | Não | Sim | ADMIN e COMUNICACAO |
| Upload documentos sensíveis | Sim | Sim | Não | Não | LGPD, atestado e laudo |
| Upload delete | Sim | Sim | Não | Sim | ADMIN, SECRETARIA e COMUNICACAO |
| Site Config leitura | Público | Público | Público | Público | CMS público |
| Site Config edição | Sim | Não | Não | Sim | ADMIN e COMUNICACAO |
| Certificados emissão acadêmica | Sim | Sim | Sim | Não | ADMIN, SECRETARIA e PROFESSOR |
| Certificados modelos/honraria | Sim | Sim | Não | Não | ADMIN e SECRETARIA |
| Certificados leitura modelos | Sim | Sim | Sim | Sim | Todos internos |
| Contatos criação | Público | Público | Público | Público | Fale Conosco público |
| Contatos gestão | Sim | Sim | Não | Sim | ADMIN, SECRETARIA e COMUNICACAO |
| Apoiadores públicos | Público | Público | Público | Público | Listagem pública |
| Apoiadores gestão | Sim | Sim | Não | Sim | ADMIN, SECRETARIA e COMUNICACAO |
| Apoiadores reativar | Sim | Não | Não | Não | Apenas ADMIN |

---

# 3. Regras Críticas

- Somente `ADMIN` pode gerenciar usuários internos.
- `SECRETARIA` opera alunos, turmas, documentos acadêmicos e certificados.
- `PROFESSOR` opera chamadas e consulta turmas/frequências permitidas.
- `COMUNICACAO` opera comunicados, CMS, contatos e apoiadores.
- Rotas públicas ficam separadas em comunicados, site-config, contatos e apoiadores.
- Backend é a fonte de verdade das permissões; frontend apenas reflete a UI.

---

# 4. Pontos de Atenção

- Rotas protegidas sem `@Roles()` ficam acessíveis a qualquer usuário autenticado.
- Há mistura entre enum `Role.ADMIN` e strings `'ADMIN'`.
- O decorator `Roles` aceita `string[]`; idealmente deveria aceitar `Role[]`.
- `RolesGuard` depende de `AuthGuard` preencher `request.user` antes.

---

# 5. Melhorias Futuras

- Padronizar todos os `@Roles()` com enum `Role`.
- Tipar `Roles(...roles)` como `Role[]`.
- Criar testes e2e por perfil.
- Criar decorator composto para autenticação + roles.
- Revisar rotas sem `@Roles()` para confirmar intenção.

---

# 6. Resumo Técnico Final

A matriz RBAC está coerente com os papéis institucionais. O ponto mais importante é que o CRUD de usuários está restrito ao `ADMIN`, enquanto os demais perfis possuem permissões segmentadas por responsabilidade.

Criticidade: muito alta.

Complexidade: alta.
