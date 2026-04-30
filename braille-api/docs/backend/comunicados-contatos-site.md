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
* Cache em endpoints de consulta com cuidado para nao reutilizar resposta entre filtros diferentes.

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
* `GET /comunicados` deixa o `CacheInterceptor` usar a URL completa como chave, preservando filtros e paginacao.
* `GET /site-config/secoes/:secao` nao usa cache para evitar conteudo antigo apos edicao pontual.

---

# 8. Pontos de Atencao Tratados

* A quebra de contrato de auditoria manual no `ContatosService` foi totalmente resolvida utilizando o helper unificado `toAuditMetadata(auditUser)`. O spread blindado mapeia corretamente `sub` para `autorId`, erradicando falhas de tipagem no log.
* A liberação da flag `style` no sanitizador de texto rico (`SanitizeHtmlPipe`) foi documentada como comportamento planejado. Não configura risco de *CSS Injection*, visto que o DOMPurify intercepta nativamente `expression()` e links suspeitos, sendo essencial para manter a fidelidade visual dos Comunicados editados via CMS.
* O fluxo de "Replace-all" nas configurações foi refinado: a mutação de Configurações Gerais (`updateMany`) opera de forma cirúrgica, deletando exclusivamente as chaves enviadas no payload. Já na mutação de Seções (`updateSecao`), o apagamento em bloco reflete exatamente o comportamento determinístico do frontend, que sempre reenvia a seção completa, prevenindo acúmulo de chaves fantasmas.

* A listagem publica de comunicados nao usa `@CacheKey` fixo, evitando colisao entre `/comunicados`, filtros e paginas.
* A rota dinamica de secao especifica do site-config permanece sem cache, mantendo resposta atualizada depois de `PATCH /site-config/secoes/:secao`.

---

# 9. Relacao com Outros Modulos

* `Auth` e `Roles` protegem gestao.
* `AuditLog` registra mudancas.
* `Upload` limpa imagens.
* `Common` fornece sanitizacao.

---

# 10. Resumo Tecnico Final

Comunicados, Contatos e Site Config formam em conjunto o núcleo do CMS Institucional. É um grupo de domínios com elevada exposição pública (Fale Conosco) e responsabilidade visual. O código hoje se encontra blindado contra quebras de formatação visual sem comprometer a segurança, possui auditoria manual fortemente tipada que não rompe os padrões globais e apresenta alta performance através da camada de cache sobre defaults infalíveis. O modelo adotado de persistência para as transações de configuração elimina lixos de versões passadas, resultando num ambiente resiliente e limpo para manutenção futura.
