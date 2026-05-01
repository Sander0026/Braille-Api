# 51 — AtestadosController (`src/atestados/atestados.controller.ts`)

---

# 1. Visão Geral

O `AtestadosController` expõe as rotas HTTP responsáveis por criar, listar, visualizar, atualizar, pré-visualizar e remover atestados médicos/justificativas de falta de alunos.

Responsabilidades principais:

- declarar rotas aninhadas de atestados por aluno;
- declarar rotas diretas por ID de atestado;
- aplicar autenticação JWT;
- delegar regra de negócio ao `AtestadosService`;
- extrair usuário de auditoria com `getAuditUser(req)`;
- aplicar autorização administrativa na remoção;
- desativar auditoria automática com `@SkipAudit()`.

---

# 2. Decorators de Classe

```txt
@ApiTags('Atestados (Justificativas de Falta)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@SkipAudit()
@Controller()
```

Impacto:

- agrupa endpoints no Swagger;
- exige token Bearer;
- aplica autenticação JWT;
- desativa auditoria automática;
- permite rotas em múltiplas bases porque `@Controller()` não define prefixo fixo.

Ponto importante:

```txt
RolesGuard não é aplicado na classe inteira.
```

Ele aparece apenas na rota de remoção.

---

# 3. Rotas Aninhadas por Aluno

## `POST /alunos/:alunoId/atestados`

Cria atestado para um aluno e justifica faltas automaticamente no período informado.

Entrada:

```txt
Param: alunoId
Body: CreateAtestadoDto
Request: AuthenticatedRequest
```

Chama:

```txt
atestadosService.criar(alunoId, dto, auditUser)
```

## `GET /alunos/:alunoId/atestados`

Lista todos os atestados de um aluno.

Chama:

```txt
atestadosService.listarPorAluno(alunoId)
```

## `GET /alunos/:alunoId/atestados/preview`

Simula quais faltas seriam justificadas antes da criação do atestado.

Entrada:

```txt
Param: alunoId
Query: dataInicio
Query: dataFim
```

Chama:

```txt
atestadosService.previewJustificativas(alunoId, dataInicio, dataFim)
```

---

# 4. Rotas Diretas por ID

## `GET /atestados/:id`

Visualiza o detalhe de um atestado.

Chama:

```txt
atestadosService.findOne(id)
```

## `PATCH /atestados/:id`

Atualiza dados básicos do atestado.

Campos editáveis:

- `motivo`;
- `arquivoUrl`.

Chama:

```txt
atestadosService.atualizar(id, dto, auditUser)
```

## `DELETE /atestados/:id`

Remove atestado e reverte faltas justificadas para falta comum.

Proteção adicional:

```txt
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SECRETARIA')
```

Chama:

```txt
atestadosService.remover(id, auditUser)
```

---

# 5. Permissões

Todas as rotas exigem autenticação por causa de:

```txt
@UseGuards(AuthGuard)
```

Apenas a remoção possui restrição de role explícita:

```txt
ADMIN
SECRETARIA
```

Ponto de atenção:

```txt
Criar, listar, preview, detalhar e atualizar exigem autenticação, mas não possuem RolesGuard explícito.
```

---

# 6. Auditoria

O controller usa:

```txt
@SkipAudit()
```

Portanto, a auditoria automática está desativada.

As rotas mutáveis enviam `getAuditUser(req)` para o service:

- criação;
- atualização;
- remoção.

O service registra auditoria manual para essas operações.

---

# 7. Segurança e Qualidade

## Segurança

- todas as rotas exigem autenticação;
- remoção é restrita a ADMIN/SECRETARIA;
- auditoria manual recebe usuário autenticado;
- controller não executa regra sensível diretamente;
- remoção delega reversão transacional ao service.

## Qualidade

- controller fino;
- rotas organizadas por aluno e por ID;
- Swagger documentado;
- uso de `ApiResponse` padronizado;
- autorização de remoção no nível HTTP.

---

# 8. Pontos de Atenção

- `RolesGuard` não está aplicado na classe inteira.
- Criar, atualizar e visualizar atestados podem ser operações sensíveis e hoje dependem apenas de autenticação.
- `@Roles('ADMIN', 'SECRETARIA')` usa strings; pode ser padronizado para enum `Role`.
- `@SkipAudit()` exige que qualquer nova mutação seja auditada manualmente no service.
- A rota de preview consulta dados sensíveis de frequência e pode precisar de restrição por perfil.

---

# 9. Melhorias Futuras

- Definir matriz de acesso completa para atestados.
- Aplicar `RolesGuard` em todas as rotas sensíveis.
- Padronizar roles com enum `Role`.
- Criar DTO de params para validar `alunoId` e `id` como UUID.
- Adicionar respostas Swagger mais completas.
- Considerar auditoria de preview se a política exigir rastreio de consultas sensíveis.

---

# 10. Resumo Técnico Final

O `AtestadosController` é uma camada HTTP enxuta para o fluxo de justificativas de falta.

Ele organiza rotas por aluno e por atestado, delega regras complexas ao service e restringe remoção a perfis administrativos.

Criticidade: alta.

Complexidade: média.

O principal ponto de evolução é definir e aplicar uma matriz de permissões explícita para todas as rotas, especialmente criação, atualização e preview.
