# Modulo: Audit Log

---

# 1. Visao Geral

## Objetivo

Documentar `src/audit-log` e a estrategia de auditoria manual/global.

## Responsabilidade

Registrar eventos criticos de negocio em `AuditLog`, consultar historico, fornecer estatisticas e preservar snapshots `oldValue` e `newValue` sem bloquear o fluxo principal.

## Fluxo de Funcionamento

Services de dominio chamam `AuditLogService.registrar()` com entidade, registro, acao e autor. O `AuditInterceptor` tambem audita mutacoes genericas nao excluidas. O controller de auditoria permite somente `ADMIN` consultar logs, estatisticas e historico de registro.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Audit Trail.
* Fire-and-forget logging.
* Interceptor Pattern.
* Query Object via `QueryAuditDto`.
* Snapshot Pattern.

## Justificativa Tecnica

A auditoria desacoplada evita que falhas de log derrubem operacoes principais. Os snapshots possibilitam rastreabilidade para LGPD, operacao academica, certificacoes e administracao. O acesso somente para `ADMIN` reduz exposicao de historico sensivel.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Controller protegido por `AuthGuard`, `RolesGuard` e `@Roles('ADMIN')`.
2. `GET /api/audit-log` aplica filtros de `QueryAuditDto`.
3. `AuditLogService.findAll` monta `Prisma.AuditLogWhereInput`.
4. `findMany` e `count` rodam em paralelo.
5. `GET /stats` calcula total, logs de hoje em Brasilia e top acoes.
6. `GET /:entidade/:registroId` retorna ate 50 eventos.
7. `registrar` serializa valores com `structuredClone` e grava no banco.

## Dependencias Internas

* `PrismaService`
* `ApiResponse`
* `AuthGuard`, `RolesGuard`, `Roles`
* `AuditOptions`

## Dependencias Externas

* `@prisma/client`
* NestJS common/swagger
* `class-validator`, `class-transformer`

---

# 4. Dicionario Tecnico

## Variaveis

* `entidade`: nome canonico do dominio auditado.
* `registroId`: identificador do registro afetado.
* `acao`: enum `AuditAcao`.
* `autorId`, `autorNome`, `autorRole`: snapshot do usuario.
* `ip`, `userAgent`: contexto HTTP.
* `oldValue`, `newValue`: estado antes/depois.
* `inicioHoje`: meia-noite em `America/Sao_Paulo`.

## Funcoes e Metodos

* `registrar(opts)`: persiste evento de auditoria com tratamento de erro interno.
* `findAll(query)`: lista logs paginados.
* `findByRegistro(entidade, registroId)`: historico de um registro.
* `stats()`: totais e agrupamento por acao.
* `serializarSeguro(val)`: converte valor para JSON seguro.
* `midnightBrasilia()`: calcula inicio do dia no fuso correto.

## Classes

* `AuditLogController`
* `AuditLogService`
* `QueryAuditDto`

## Interfaces e Tipagens

* `AuditOptions`: contrato de entrada do service.
* `AuditAcao`: `CRIAR`, `ATUALIZAR`, `EXCLUIR`, `ARQUIVAR`, `RESTAURAR`, `LOGIN`, `LOGOUT`, `MATRICULAR`, `DESMATRICULAR`, `FECHAR_DIARIO`, `REABRIR_DIARIO`, `MUDAR_STATUS`.

---

# 5. Servicos e Integracoes

## APIs

* `GET /api/audit-log`: filtros `page`, `limit`, `entidade`, `registroId`, `autorId`, `acao`, `de`, `ate`.
* `GET /api/audit-log/stats`: estatisticas.
* `GET /api/audit-log/:entidade/:registroId`: historico do registro.

## Banco de Dados

Tabela `AuditLog` com indices por entidade/registro, autor, data e acao.

## Servicos Externos

Nao ha integracao externa.

---

# 6. Seguranca e Qualidade

## Seguranca

* Consulta permitida somente a `ADMIN`.
* Erro de auditoria nao vaza ao cliente.
* Interceptor sanitiza campos sensiveis como senha, token, hash e secret.
* Payloads longos e arrays grandes sao truncados antes do log automatico.

## Qualidade

* `where` tipado com Prisma.
* `Promise.all` em consultas com contagem.
* Datas de estatistica corrigidas para fuso de Brasilia.

## Performance

* Indices do schema aceleram filtros por entidade, autor, acao e data.
* `serializarSeguro` evita ciclos e valores nao serializaveis.

---

# 7. Regras de Negocio

* Auditoria nunca deve impedir a operacao principal.
* Acoes manuais em services prevalecem para evitar duplicacao.
* Historico de registro e limitado a 50 entradas.
* Logs de hoje usam dia civil de Brasilia, nao UTC do servidor.

---

# 8. Pontos de Atencao

* `ContatosService` espalha `...auditUser` diretamente, enquanto outros services mapeiam `autorId`; isso pode gerar campos incorretos se `AuditUser` nao casar com `AuditOptions`.
* A lista de paths excluidos no interceptor exige manutencao manual.
* `structuredClone` descarta valores problematicos silenciosamente, o que protege o fluxo mas pode perder detalhe de auditoria.

---

# 9. Relacao com Outros Modulos

* Quase todos os services de negocio chamam `AuditLogService`.
* `AuditInterceptor` cobre mutacoes sem instrumentacao manual.
* `getAuditUser` fornece contexto de autor para logs.

---

# 10. Resumo Tecnico Final

Audit Log e um modulo de alta criticidade para rastreabilidade, LGPD e governanca. A complexidade e media por combinar logs manuais e interceptor global. O principal cuidado futuro e padronizar totalmente o contrato de `AuditUser` para `AuditOptions` e automatizar a deteccao de rotas ja auditadas manualmente.

