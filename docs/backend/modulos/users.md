# Módulo: Users (Funcionários)

---

# 1. Visão Geral

## Objetivo
Gerenciar o ciclo de vida dos funcionários do instituto: criação, atualização, inativação, restauração e controle de acesso por perfil (Role).

## Responsabilidade
CRUD de usuários do sistema com proteção de auto-exclusão e geração automática de matrícula funcional. Diferente dos alunos (Beneficiaries), os usuários são os **operadores** do sistema.

---

# 2. Arquitetura

- **Surgical SELECT:** campos sensíveis (`senha`, `refreshToken`) excluídos de todas as respostas
- **`resolverUserId()`:** centraliza a lógica de "é o próprio usuário ou um admin operando sobre outro"
- **Senha padrão de env:** `SENHA_PADRAO_USUARIO` — nunca hardcoded
- **`@SkipAudit()` + auditoria manual:** para ter `oldValue` preciso nas atualizações

---

# 3. Métodos Principais

| Método | Roles | Descrição |
|---|---|---|
| `create(dto, auditUser)` | ADMIN | Cria usuário com senha hash + matricula funcional + `precisaTrocarSenha: true` |
| `findAll(query)` | ADMIN, SECRETARIA | Listagem paginada com filtros de role, status, busca |
| `findOne(id)` | ADMIN, SECRETARIA | Detalhe sem senha |
| `update(id, dto, auditUser)` | ADMIN | Atualiza dados; deleta foto antiga do Cloudinary se mudou |
| `desativar(id, autorId)` | ADMIN | Soft delete: `statusAtivo: false` — com proteção de auto-exclusão |
| `restaurar(id, auditUser)` | ADMIN | Reativa usuário: `statusAtivo: true` |
| `resetarSenha(id, auditUser)` | ADMIN | Reseta para `SENHA_PADRAO_USUARIO` + `precisaTrocarSenha: true` |

---

# 4. Endpoints da API

| Método | Rota | Roles | Descrição |
|---|---|---|---|
| `POST` | `/api/usuarios` | `ADMIN` | Criar funcionário |
| `GET` | `/api/usuarios` | `ADMIN, SECRETARIA` | Listar usuários |
| `GET` | `/api/usuarios/:id` | `ADMIN, SECRETARIA` | Detalhe |
| `PATCH` | `/api/usuarios/:id` | `ADMIN` | Atualizar dados |
| `DELETE` | `/api/usuarios/:id` | `ADMIN` | Desativar |
| `PATCH` | `/api/usuarios/:id/restaurar` | `ADMIN` | Restaurar |
| `PATCH` | `/api/usuarios/:id/resetar-senha` | `ADMIN` | Resetar senha |

---

# 5. Regras de Negócio

1. **Auto-exclusão protegida:** Admin não pode desativar a própria conta
2. **Senha padrão sempre do env:** `process.env.SENHA_PADRAO_USUARIO` — falha explicitamente se não configurada
3. **`precisaTrocarSenha: true`** em toda criação e reset de senha
4. **Matrícula funcional gerada automaticamente:** formato diferente da matrícula de alunos

---

# 6. Pontos de Atenção

> [!NOTE]
> A senha nunca é retornada em nenhum endpoint. O `select` em todas as queries exclui explicitamente `senha` e `refreshToken`.

**Criticidade:** 🔴 Alta | **Complexidade:** Média | **Testes:** `users.service.spec.ts`
