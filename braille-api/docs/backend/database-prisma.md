# Modulo: Banco de Dados e Prisma

---

# 1. Visao Geral

## Objetivo

Documentar `prisma/schema.prisma`, migrations e `src/prisma/prisma.service.ts`.

## Responsabilidade

O modulo de banco define o modelo relacional PostgreSQL e fornece um singleton Prisma gerenciado pelo NestJS para conexao, logs e keep-alive.

## Fluxo de Funcionamento

`PrismaService` estende `PrismaClient`, registra listeners de eventos no construtor, conecta no `onModuleInit`, executa heartbeat `SELECT 1` a cada 4 minutos e desconecta no `onModuleDestroy`.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* ORM/Data Mapper via Prisma.
* Singleton por provider global.
* Repository Pattern indireto.
* Lifecycle Hooks do NestJS.
* Database-first controlado por migrations.

## Justificativa Tecnica

Prisma oferece tipagem forte e reduz SQL manual. O keep-alive foi escolhido para mitigar reconexao de bancos serverless como Neon. Indices no schema antecipam consultas frequentes de listagem, filtros, busca por documentos e relatorios.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. Nest instancia `PrismaService`.
2. O construtor configura logs `error`, `warn` e `info`.
3. Eventos do Prisma sao roteados para `Logger`.
4. Na inicializacao, `$connect()` abre conexao.
5. Um intervalo executa `SELECT 1` a cada 4 minutos.
6. Em shutdown, o intervalo e limpo e `$disconnect()` encerra a conexao.

## Dependencias Internas

* Todos os services que usam `PrismaService`.
* `PrismaModule`.

## Dependencias Externas

* `@prisma/client`.
* PostgreSQL.

---

# 4. Dicionario Tecnico

## Variaveis

* `keepAliveInterval`: handle do heartbeat.
* `logConfig`: configuracao de eventos Prisma.
* `DATABASE_URL`: URL principal.
* `DIRECT_URL`: URL direta.

## Funcoes e Metodos

* `onModuleInit()`: conecta e inicia keep-alive.
* `onModuleDestroy()`: limpa keep-alive e desconecta.
* `$queryRaw`: usado em heartbeats e health check.

## Classes

* `PrismaService`: provider singleton de persistencia.

## Interfaces e Tipagens

* Enums: `Role`, `MatriculaStatus`, `DiaSemana`, `TurmaStatus`, `TipoDeficiencia`, `CausaDeficiencia`, `PreferenciaAcessibilidade`, `CategoriaComunicado`, `CorRaca`, `StatusFrequencia`, `AuditAcao`, `TipoApoiador`, `TipoCertificado`.
* Modelos: `User`, `Aluno`, `Turma`, `MatriculaOficina`, `GradeHoraria`, `Frequencia`, `Atestado`, `Comunicado`, `MensagemContato`, `LaudoMedico`, `SiteConfig`, `ConteudoSecao`, `AuditLog`, `Apoiador`, `AcaoApoiador`, `ModeloCertificado`, `CertificadoEmitido`.

---

# 5. Servicos e Integracoes

## APIs

Nao expoe endpoints diretamente.

## Banco de Dados

* `User`: funcionarios, credenciais, refresh token, roles, contato e endereco.
* `Aluno`: beneficiarios, documentos, LGPD, perfil de deficiencia, dados sociais e saude.
* `Turma`: oficinas, professor, grade, status academico e modelo de certificado.
* `MatriculaOficina`: vinculo aluno-turma com status e encerramento.
* `GradeHoraria`: dia e minutos desde meia-noite, com `@@unique([turmaId, dia])`.
* `Frequencia`: chamada por aluno/turma/data, com diario fechado e justificativa.
* `Atestado`: periodo medico que justifica faltas.
* `LaudoMedico`: historico documental de laudos.
* `Comunicado`: CMS de noticias e publicacoes.
* `MensagemContato`: fale conosco publico.
* `SiteConfig` e `ConteudoSecao`: CMS de configuracao do site.
* `AuditLog`: historico imutavel de acoes.
* `Apoiador` e `AcaoApoiador`: CRM de parceiros.
* `ModeloCertificado` e `CertificadoEmitido`: templates e emissoes.

## Servicos Externos

PostgreSQL/Neon e Prisma Query Engine.

---

# 6. Seguranca e Qualidade

## Seguranca

* Query logs com parametros sensiveis permanecem desabilitados.
* Erros Prisma sao logados internamente.
* Filtros globais impedem vazamento de schema/SQL.
* Campos sensiveis existem no banco (`senha`, `refreshToken`), mas services usam selects cirurgicos para evitar retorno indevido.

## Qualidade

* Indices em campos de busca e filtros.
* Constraints `@unique` em CPF, RG, matriculas, username, email e codigo de certificado.
* Relacionamentos explicitos.

## Performance

* Indices compostos para frequencia por turma/data e certificados por aluno/turma.
* Keep-alive reduz latencia apos ociosidade.
* Uso de `@db.Date` em frequencias e documentos evita variacao de milissegundos.

---

# 7. Regras de Negocio

* Uma frequencia por aluno, turma e data.
* Uma grade por turma e dia.
* Matricula ativa duplicada e validada no service, nao por `@@unique`, para permitir retorno do aluno a mesma turma apos encerramento.
* AuditLog usa `cuid()` por compatibilidade de schema.
* Certificados podem ser academicos ou honrarias.

---

# 8. Pontos de Atencao Tratados

* Uma documentação prévia apontava falha de encoding nos comentários do `schema.prisma` via terminal, mas a auditoria confirmou que o arquivo está em `UTF-8` puro e livre de caracteres corrompidos, tratando-se apenas de limitação visual de alguns emuladores de prompt.
* A trava de exclusividade da `GradeHoraria` impedia mais de um turno. O problema foi sanado alterando a constraint `@@unique([turmaId, dia])` para `@@index([turmaId, dia])`, permitindo assim múltiplos turnos no mesmo dia para a mesma turma (a sobreposição real é gerida via API).
* O risco de dessincronização do campo legado `presente` vs enum oficial `status` na tabela `Frequencia` foi neutralizado. O backend implementa conversores duplos (`statusFromPresente` e `presenteFromStatus`) no `FrequenciasService`, garantindo integridade e salvamento simultâneo na transação do BD, salvando os relatórios de possíveis falhas de consistência.

---

# 9. Relacao com Outros Modulos

Todos os dominios dependem do schema Prisma. `Auth`, `Users`, `Beneficiaries`, `Turmas`, `Frequencias`, `Certificados`, `Apoiadores`, `CMS`, `Upload` e `AuditLog` usam entidades definidas aqui.

---

# 10. Resumo Tecnico Final

O Prisma é a camada fundacional e opera com criticidade máxima. A modelagem abrange uma vasta gama de operações do instituto com alta eficácia de constraints e performance de indicação (`@@index`). Após essa auditoria, fica explícito que os maiores riscos históricos (como dados divergentes do campo Frequência e travas de horários errôneas) já foram mitigados por implementações maduras nas camadas de serviço e correções de chaves (`@@unique` para `@@index`). O ORM se provou altamente resiliente a refatorações iterativas sem downtime e é a base de um fluxo SOLID impecável no projeto.

