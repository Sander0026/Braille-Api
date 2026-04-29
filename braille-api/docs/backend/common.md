# Modulo: Common

---

# 1. Visao Geral

## Objetivo

Documentar `src/common`, incluindo Swagger config, DTO de resposta, filtros Prisma, helpers, interfaces, interceptor de auditoria e pipe de sanitizacao HTML.

## Responsabilidade

Fornecer infraestrutura transversal de seguranca, auditoria, sanitizacao, formatacao, matriculas, contratos de request e tratamento padronizado de erros.

## Fluxo de Funcionamento

Controllers e services importam helpers e interfaces. O `AuditInterceptor` e registrado globalmente em `AppModule`. Filtros Prisma tambem sao globais. `SanitizeHtmlPipe` e aplicado em rotas que recebem conteudo HTML editavel.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* Shared Kernel.
* Interceptor Pattern.
* Filter Pattern.
* Pipe Pattern.
* Helper Functions.
* DTO generico de resposta.

## Justificativa Tecnica

Centralizar comportamento transversal reduz duplicacao e evita divergencias de seguranca. Sanitizacao, auditoria e erros de banco sao preocupacoes sistemicas, nao regras isoladas de cada modulo.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `PrismaExceptionFilter` intercepta `PrismaClientKnownRequestError`.
2. Codigos `P2002`, `P2003`, `P2025` viram mensagens publicas seguras.
3. `PrismaValidationFilter` intercepta erros de validacao Prisma e retorna `400`.
4. `SanitizeHtmlPipe` sanitiza apenas `metadata.type === 'body'`.
5. Strings JSON validas sao parseadas, sanitizadas e serializadas.
6. `AuditInterceptor` mapeia metodo HTTP para `AuditAcao`, exclui paths ja auditados e grava log no `tap`.
7. Helpers de matricula geram sequenciais anuais com verificacao de unicidade.
8. Helpers de data calculam carga horaria e formatam datas sem deslocamento indevido.

## Dependencias Internas

* `AuditLogService`
* `AuthenticatedRequest`
* `AuditUser`

## Dependencias Externas

* `@prisma/client`
* `dompurify`, `jsdom`
* `rxjs`
* NestJS common/core

---

# 4. Dicionario Tecnico

## Variaveis

* `HTTP_STATUS_BY_CODE`: mapeia erros Prisma para HTTP.
* `MSG_PUBLICAS`: mensagens seguras ao cliente.
* `ALLOWED_TAGS`, `ALLOWED_ATTR`: allowlist HTML.
* `ACAO_MAP`: heuristica metodo/path para `AuditAcao`.
* `ENTIDADE_MAP`: segmento de rota para entidade canonica.
* `PATHS_EXCLUIDOS`: rotas nao auditadas automaticamente.
* `CAMPOS_SENSIVEIS`: chaves removidas do log.
* `MAX_TENTATIVAS`: limite para gerar matricula unica.

## Funcoes e Metodos

* `getAuditUser(req)`: extrai contexto de auditoria.
* `resolverIp(req)`: resolve IP por `x-forwarded-for`, `x-real-ip` ou socket.
* `calcularCargaHorariaTotal(dataInicio, dataFim, gradeHoraria)`: soma minutos por dia no intervalo.
* `formatarDataBR(isoStr)`: formata data sem voltar dia por timezone.
* `preencherTemplateTexto(template, vars)`: substitui tags de certificados.
* `gerarMatriculaAluno(prisma)`: gera `YYYYNNNNN`.
* `gerarMatriculaStaff(prisma)`: gera `PYYYYNNNNN`.
* `sanitizePayload`, `sanitizeString`, `sanitizeArray`: protegem logs automaticos.

## Classes

* `ApiResponse<T>`
* `PrismaExceptionFilter`
* `PrismaValidationFilter`
* `AuditInterceptor`
* `SanitizeHtmlPipe`

## Interfaces e Tipagens

* `AuditUser`
* `AuthenticatedUser`
* `AuthenticatedRequest`
* `TemplateVars`
* `GradeHorariaInput`

---

# 5. Servicos e Integracoes

## APIs

Nao expoe endpoints diretamente.

## Banco de Dados

Helpers de matricula consultam `Aluno` e `User`. Filtros Prisma tratam erros do banco. Interceptor grava em `AuditLog`.

## Servicos Externos

Nao chama servicos externos diretamente.

---

# 6. Seguranca e Qualidade

## Seguranca

* Mensagens Prisma publicas nao expoem nomes de tabelas/colunas.
* Sanitizacao HTML recursiva com allowlist.
* Auditoria remove segredo, token, senha e hashes.
* Truncamento de strings evita logs com base64 ou blobs.
* `getAuditUser` usa fallback de menor privilegio (`SECRETARIA`) quando role ausente.

## Qualidade

* Helpers puros fora das classes melhoram testabilidade.
* Tipos Prisma evitam `any` em filtros.
* Matricula possui limite anti busy-wait.

## Performance

* DOMPurify/JSDOM e singleton.
* Fontes e arrays grandes nao entram inteiros em auditoria.
* `calcularCargaHorariaTotal` pre-processa grade por dia.

---

# 7. Regras de Negocio

* Erro `P2002` vira conflito por violacao de unico.
* Erro `P2003` vira operacao invalida por vinculo.
* Erro `P2025` vira nao encontrado.
* Matricula de aluno usa ano corrente e 5 digitos.
* Matricula de staff usa prefixo `P` mais ano e 5 digitos.
* Templates aceitam aliases para aluno/apoiador/evento/data.

---

# 8. Pontos de Atencao

* `PATHS_EXCLUIDOS` precisa ser atualizado quando novas rotas fizerem auditoria manual.
* Sanitizacao HTML permite `style` e `class`, o que pode ser necessario para CMS, mas deve ser revisto conforme politica de XSS.
* Geracao de matricula baseada em count pode sofrer corrida; alguns fluxos compensam com retry/transacao, outros dependem da constraint unica.

---

# 9. Relacao com Outros Modulos

* Todos os controllers protegidos usam `AuthenticatedRequest` e `getAuditUser`.
* `TurmasService` usa `calcularCargaHorariaTotal`.
* `ApoiadoresService` e `CertificadosService` usam helpers de template/data.
* `UsersService` e `BeneficiariesService` usam helpers de matricula.

---

# 10. Resumo Tecnico Final

Common e o nucleo transversal do backend. Sua criticidade e alta porque erros, sanitizacao e auditoria impactam toda a aplicacao. A complexidade e media-alta por conter seguranca, padronizacao e regras auxiliares compartilhadas.

