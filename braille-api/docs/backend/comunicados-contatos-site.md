# Modulo: Comunicados, Contatos e Site Config

---

# 1. Visao Geral

## Objetivo

Documentar `src/comunicados`, `src/contatos` e `src/site-config`, dominios ligados ao site publico e CMS institucional.

## Responsabilidade

Comunicados gerenciam publicacoes. Contatos recebem mensagens do fale conosco e controlam leitura/exclusao. Site Config gerencia configuracoes gerais e conteudo editavel das secoes da home.

## Fluxo de Funcionamento

Comunicados e Site Config usam sanitizacao HTML em mutacoes. Contatos permitem criacao publica e leitura administrativa. Site Config retorna defaults quando nao ha registro no banco e atualiza configuracoes/secoes por transacao.

---

# 2. Arquitetura e Metodologias

## Padroes Arquiteturais Identificados

* CMS Pattern.
* Public/Private Endpoint Split.
* Sanitization Pipe.
* CacheInterceptor.
* Audit Trail.
* Replace-all Transaction para configuracoes.

## Justificativa Tecnica

Conteudo publico precisa ser editavel, cacheavel e sanitizado. Contatos publicos devem aceitar entrada sem autenticacao, mas consulta e gestao precisam ser restritas. Defaults garantem que o site renderize mesmo sem seed completo.

---

# 3. Fluxo Interno do Codigo

## Fluxo de Execucao

1. `ComunicadosService.create` cria comunicado com autor do token.
2. `SanitizeHtmlPipe` limpa HTML de titulo/conteudo/imagem quando aplicado.
3. Listagem ordena fixados primeiro e depois mais recentes.
4. Atualizacao remove imagem antiga em background se substituida.
5. Contato publico cria `MensagemContato`.
6. Listagem de contatos omite `mensagem` longa; detalhe inclui.
7. Marcar como lida e idempotente.
8. Site Config `getAll` combina defaults com registros do banco.
9. `updateMany` remove chaves enviadas e recria em transacao.
10. Secoes usam chave composta `(secao,chave)` e tambem replace-all por secao.

## Dependencias Internas

* `PrismaService`
* `AuditLogService`
* `UploadService` em comunicados
* `SanitizeHtmlPipe`
* `getAuditUser`

## Dependencias Externas

* `@nestjs/cache-manager`
* `@prisma/client`

---

# 4. Dicionario Tecnico

## Variaveis

* `COMUNICADO_SELECT`: contrato de retorno de comunicados.
* `SELECT_LISTA`, `SELECT_DETALHE`, `SELECT_AUDIT_SNAPSHOT`: projecoes de contato.
* `SITE_CONFIG_DEFAULTS`: fallback global do site.
* `SECAO_DEFAULTS`: fallback por secao da home.
* `fixado`: prioriza comunicado na listagem.
* `lida`: status da mensagem de contato.
* `secao`, `chave`, `valor`: modelo de conteudo editavel.

## Funcoes e Metodos

* `ComunicadosService.create/findAll/findOne/update/remove`.
* `deleteImagemAsync(publicId, contexto)`: limpeza auxiliar.
* `ContatosService.create`: cria mensagem publica.
* `marcarComoLida(id,auditUser)`: idempotente.
* `remove(id,auditUser)`: exclui contato e audita.
* `findAll(query)`, `findOne(id)`: consulta contatos.
* `SiteConfigService.getAll()`: configura defaults + banco.
* `updateMany(dados,auditUser)`: atualiza configs gerais.
* `getSecoes()`, `getSecao(secao)`, `updateSecao(secao,dados,auditUser)`: CMS de secoes.

## Classes

* `ComunicadosController`, `ComunicadosService`.
* `CreateComunicadoDto`, `UpdateComunicadoDto`, `QueryComunicadoDto`.
* `ContatosController`, `ContatosService`.
* `CreateContatoDto`, `QueryContatoDto`.
* `SiteConfigController`, `SiteConfigService`.

## Interfaces e Tipagens

* `CategoriaComunicado`
* `MensagemContato`
* `SiteConfig`
* `ConteudoSecao`
* `AuditUser`

---

# 5. Servicos e Integracoes

## APIs

* `POST /api/comunicados`
* `PATCH /api/comunicados/:id`
* `DELETE /api/comunicados/:id`
* `GET /api/comunicados`
* `GET /api/comunicados/:id`
* `POST /api/contatos`
* `GET /api/contatos`
* `GET /api/contatos/:id`
* `PATCH /api/contatos/:id/lida`
* `DELETE /api/contatos/:id`
* `GET /api/site-config`
* `GET /api/site-config/secoes`
* `GET /api/site-config/secoes/:secao`
* `PATCH /api/site-config`
* `PATCH /api/site-config/secoes/:secao`

## Banco de Dados

* `Comunicado`
* `MensagemContato`
* `SiteConfig`
* `ConteudoSecao`

## Servicos Externos

Cloudinary para imagem de capa removida via `UploadService`.

---

# 6. Seguranca e Qualidade

## Seguranca

* Conteudo HTML passa por sanitizacao.
* Gestao de contatos exige roles `ADMIN`, `COMUNICACAO`, `SECRETARIA`.
* Site Config mutavel exige `ADMIN` ou `COMUNICACAO`.
* Campos longos de contato nao aparecem na listagem.

## Qualidade

* Defaults evitam site quebrado.
* Atualizacoes de config usam transacao.
* Auditoria registra estado antes/depois.
* Cache em endpoints de consulta.

## Performance

* CacheInterceptor em listagens/configs.
* Projecoes evitam campos pesados.
* Remocao de imagem antiga e fire-and-forget.

---

# 7. Regras de Negocio

* Comunicado fixado aparece antes dos demais.
* Mensagem ja lida nao gera escrita repetida.
* Site sempre retorna defaults mesmo sem dados persistidos.
* Atualizacao de secao substitui a secao inteira.

---

# 8. Pontos de Atencao

* `ContatosService` usa spread de `auditUser` em auditoria, possivelmente diferente do contrato `autorId`.
* `SanitizeHtmlPipe` permite atributo `style`; revisar politica conforme risco de CSS injection.
* Replace-all em configuracoes pode apagar chaves nao enviadas dentro do escopo atualizado.

---

# 9. Relacao com Outros Modulos

* `Auth` e `Roles` protegem gestao.
* `AuditLog` registra mudancas.
* `Upload` limpa imagens.
* `Common` fornece sanitizacao.

---

# 10. Resumo Tecnico Final

Comunicados, Contatos e Site Config formam o CMS do sistema. Criticidade media-alta por impacto publico e entrada de usuario. A complexidade e media. Os principais cuidados sao sanitizacao, cache, auditoria e contrato consistente de logs.

