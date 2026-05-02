# Política de Segurança — Braille-Api

---

## Escopo

Esta política se aplica ao repositório `Braille-Api`, o backend do sistema de gestão institucional do Instituto Luiz Braille.

---

## Versões Suportadas

| Versão | Suportada |
|---|---|
| `main` (produção) | ✅ Sim |
| branches de feature | ⚠️ Desenvolvimento apenas |
| commits anteriores | ❌ Não |

---

## Reportando Vulnerabilidades

**NÃO abra issues públicas para vulnerabilidades de segurança.**

Para reportar uma vulnerabilidade:

1. **E-mail:** Contate o responsável técnico pelo e-mail institucional
2. **Issue privada:** Use o recurso de "Security Advisory" do GitHub (se habilitado)

### O que incluir no relatório

- Descrição clara da vulnerabilidade
- Passos para reproduzir
- Impacto potencial (quais dados/sistemas podem ser afetados)
- Versão/commit afetado
- Sugestão de correção (se disponível)

### Prazo de Resposta

- **Confirmação de recebimento:** até 48 horas
- **Avaliação inicial:** até 7 dias
- **Correção e deploy:** até 30 dias (dependendo da criticidade)

---

## Medidas de Segurança Implementadas

### Autenticação e Sessões
- JWT de curta duração (15 min) + Refresh Tokens opacos (7 dias) com rotação
- Detecção de roubo de token via `previousRefreshTokenHash`
- Revogação em tempo real: contas desativadas são bloqueadas imediatamente, sem esperar JWT expirar
- Proteção contra Timing Attack (CWE-208): `dummyHash` normaliza tempo de resposta

### Autorização
- RBAC com 4 perfis: `ADMIN`, `SECRETARIA`, `PROFESSOR`, `COMUNICACAO`
- `RolesGuard` + `@Roles()` declarativos em todas as rotas restritas

### Validação e Sanitização
- `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true`
- DTOs tipados com `class-validator` em todos os endpoints
- Filtros de exceção Prisma: detalhes internos do banco nunca chegam ao cliente (CWE-209)

### Segurança de Rede
- Helmet: cabeçalhos HTTP de segurança (`X-Frame-Options`, `X-Content-Type-Options`, etc.)
- CORS: whitelist explícita de origens permitidas
- Rate limiting: 30 requisições por 60 segundos por IP (configurável)

### Proteção de Credenciais
- ZERO credenciais hardcoded (CWE-547)
- Variáveis de ambiente obrigatórias validadas no boot
- Senhas hashadas com bcrypt (10-12 rounds)
- Refresh tokens armazenados como hash bcrypt, nunca em texto plano

### Auditoria
- Trilha de auditoria imutável (apenas INSERT na tabela AuditLog)
- Campos sensíveis removidos dos logs (`senha`, `token`, `refreshToken`, etc.)
- Snapshots de quem executou cada ação (nome + cargo no momento da ação)

---

## Responsabilidades de Segurança por Role

| Ação | ADMIN | SECRETARIA | PROFESSOR | COMUNICACAO |
|---|:---:|:---:|:---:|:---:|
| Gerenciar usuários | ✅ | ❌ | ❌ | ❌ |
| Reabrir diários fechados | ✅ | ❌ | ❌ | ❌ |
| Arquivar alunos (LGPD) | ✅ | ❌ | ❌ | ❌ |
| Ver logs de auditoria | ✅ | ❌ | ❌ | ❌ |
| Gerenciar turmas | ✅ | ✅ | ❌ | ❌ |
| Registrar frequência | ✅ | ✅ | ✅ | ❌ |
| Gerenciar comunicados | ✅ | ✅ | ❌ | ✅ |

---

## Riscos Conhecidos (Residuais)

| Risco | Severidade | Status |
|---|---|---|
| Ausência de monitoramento APM em PRD (Sentry) | 🔴 Alta | ⚠️ Pendente |
| Cold start de ~30s no Render free tier | 🟡 Média | ℹ️ Aceitável para o volume atual |
| AuthGuard com query por request (sem cache) | 🟡 Média | 📋 Melhoria futura |
| Campos legados `refreshToken` no modelo User | 🟢 Baixa | 📋 Tech debt documentado |
